import type { PointType } from "@/lib/map-points";

interface PlacementDialogHandlers {
	onSelect: (type: PointType) => void;
	onCancel: () => void;
}

function createButton(
	label: string,
	className: string,
	onClick: () => void,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.className = className;
	button.addEventListener("click", onClick);
	return button;
}

export function createPlacementDialogElement({
	onSelect,
	onCancel,
}: PlacementDialogHandlers): HTMLElement {
	const root = document.createElement("div");
	root.className =
		"w-44 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg";

	const title = document.createElement("p");
	title.textContent = "Place marker";
	title.className = "mb-2 text-xs font-medium text-zinc-500";

	const actions = document.createElement("div");
	actions.className = "flex gap-2";

	const workButton = createButton(
		"Work",
		"flex-1 rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700",
		() => onSelect("work"),
	);

	const homeButton = createButton(
		"Home",
		"flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100",
		() => onSelect("home"),
	);

	const cancelButton = createButton(
		"Cancel",
		"mt-2 w-full text-center text-xs text-zinc-400 transition-colors hover:text-zinc-600",
		onCancel,
	);

	actions.append(workButton, homeButton);
	root.append(title, actions, cancelButton);

	return root;
}
