import os
import pandas as pd
import geopandas as gpd
import shapely
import osmnx as ox
import networkit as nk
from .backend import Backend
from .location import Location, ChargingStation, DayOfWeek, ChargerType


DIR_HERE = os.path.dirname(os.path.abspath(__file__))


class ConcreateBackend(Backend):
    def __init__(self):
        # self._drive_map_set = self._create_map_set('')
        self._stations = self._load_stations(os.path.join(DIR_HERE, '..', 'data', 'chargers_mpo.gpkg'))

    def best_charging_stations(self, location: Location) -> list[ChargingStation]:
        stations = self._stations_within_range(location.lat, location.long, 1000)

        chargers = []

        for _, row in stations.iterrows():
            # geometry → lon/lat
            lon = row.geometry.x
            lat = row.geometry.y

            connectors = [
                ("connector_1_type", "connector_1_power_kw"),
                ("connector_2_type", "connector_2_power_kw"),
                ("connector_3_type", "connector_3_power_kw"),
            ]

            for type_col, power_col in connectors:
                charger_type = row.get(type_col)
                power = row.get(power_col)

                # skip missing connectors
                if pd.isna(charger_type) or pd.isna(power):
                    continue

                chargers.append(
                    ChargingStation(
                        lat=lat,
                        long=lon,
                        charger_type=self._charger_type(charger_type),
                        charger_kilowatts=int(power),
                        distance_to_location=self._air_distance(location.lat, location.long, lat, lon),
                    )
                )

        return chargers

    def estimate_distance(self, home: Location, locations: list[Location]) -> dict[DayOfWeek, float]:
        dists = {d: 0.0 for d in DayOfWeek}

        for loc in locations:
            # round trip home <-> location, in km
            dist = self._air_distance(home.lat, home.long, loc.lat, loc.long) * 2.0

            for d in loc.visits:
                dists[d] += dist

        return dists

    def find_walking_path(self, location: Location, charger: ChargingStation):
        pass

    def find_drive_path(self, location_from: Location, location_to: Location):


        pass

    def _load_graph(self, filepath):
        return ox.load_graphml(filepath)

    def _create_networkit_data(self, G):
        mapping = {node: i for i, node in enumerate(G.nodes())}
        reverse_mapping = {i: node for node, i in mapping.items()}

        nk_graph = nk.Graph(n=len(mapping), weighted=True, directed=True)

        for u, v, data in G.edges(data=True):
            w = data.get("travel_time", 1.0)
            nk_graph.addEdge(mapping[u], mapping[v], w)

        return nk_graph, mapping, reverse_mapping

    def _create_map_set(self, graph_filepath, ):
        G = self._load_graph(graph_filepath)
        nk_graph, mapping, reverse_mapping = self._create_networkit_data(G)
        return G, nk_graph, mapping, reverse_mapping

    def shortest_path_distance(self, map_set, lat1, lon1, lat2, lon2):
        G_osm, nk_graph, mapping, _ = map_set
        u_osm = ox.distance.nearest_nodes(G_osm, X=lon1, Y=lat1)
        v_osm = ox.distance.nearest_nodes(G_osm, X=lon2, Y=lat2)

        u = mapping[u_osm]
        v = mapping[v_osm]

        dijkstra = nk.distance.Dijkstra(nk_graph, u)
        dijkstra.run()

        return dijkstra.distance(v)

    def _load_stations(self, filepath):
        return gpd.read_file(filepath)

    def _stations_within_range(self, lat: float, lon: float, radius_meters: float):
        # 1. Ensure input is WGS84 (lat/lon)
        gdf = self._stations.to_crs(epsg=4326)

        # 2. Create center point
        center = gpd.GeoSeries([shapely.Point(lon, lat)], crs="EPSG:4326")

        # 3. Project BOTH to a metric CRS (Web Mercator for simplicity)
        gdf_m = gdf.to_crs(epsg=3857)
        center_m = center.to_crs(epsg=3857)

        # 4. Buffer = circle around point in meters
        buffer = center_m.iloc[0].buffer(radius_meters)

        # 5. Spatial filter
        return gdf_m[gdf_m.intersects(buffer)].to_crs(epsg=4326)

    def _air_distance(self, lat1, lon1, lat2, lon2):
        p1 = gpd.GeoSeries([shapely.Point(lon1, lat1)], crs="EPSG:4326")
        p2 = gpd.GeoSeries([shapely.Point(lon2, lat2)], crs="EPSG:4326")

        meters = p1.to_crs(3857).distance(p2.to_crs(3857)).iloc[0]
        return meters / 1000.0  # km (the optimizer works in km)

    def _charger_type(self, text: str) -> ChargerType:
        text = text.lower().strip()
        if 'ac' in text:
            return ChargerType.AC
        if 'dc' in text:
            return ChargerType.DC
        return ChargerType.UNKNOWN
