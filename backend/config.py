"""Tunable hyperparameters for the charging optimizer. Edit these freely."""

# --- driving / battery ---
CONSUMPTION_KWH_PER_KM = 0.17   # average energy used while driving
FLOOR_FRACTION = 0.50           # never let the battery drop below this (0..1)
END_FRACTION = 0.80             # battery level required at the END of the week (0..1).
                                # Lower than the 100% start, so the solver isn't forced
                                # into a last-day top-up just to refill what it started with.
BATTERY_KWH = 60.0              # real pack size. The floor binds mid-week, so the
                                # solver is FORCED to charge on specific days; light
                                # weeks may legitimately need only one charge.

# --- charging-session penalty ---
# The n-th charge "costs" n * this many km, so charging often gets pricier.
# (k charges => 10+20+...  =  KM_PER_CHARGE * k*(k+1)/2)
SESSION_PENALTY_KM_PER_CHARGE = 10.0

# --- detour penalty ---
# Detour pain grows exponentially with distance (10 km is really far):
#   penalty = DETOUR_GROWTH ** detour_km - 1   (e.g. 1km->0.4, 5km->4.4, 10km->27.9)
DETOUR_GROWTH = 1.4

# --- charging price ---
# Price (EUR/kWh) changes linearly with charging speed: faster => pricier.
#   price = PRICE_BASE_EUR + PRICE_PER_KW_EUR * charger_kilowatts
#   (e.g. 22kW -> 0.19, 50kW -> 0.23, 150kW -> 0.39)
PRICE_BASE_EUR = 0.15
PRICE_PER_KW_EUR = 0.0016

# --- cost preference ---
COST_CARE = 3                   # how much the user cares about money, 1..5
                                # (used as the weight in km per euro)

# --- solver accuracy ---
SOC_STEP_KWH = 1.0              # DP granularity: smaller = more accurate, slower

# --- response passthrough (shown by the frontend, not used by the solver) ---
FUEL_PRICE = 1.45               # EUR per litre (for the petrol comparison)
ELECTRICITY_PRICE = 0.28        # EUR per kWh
EXTRA_WALK_TIME = 12            # minutes
