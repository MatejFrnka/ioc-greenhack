interface PointActionDialogHandlers {
  onDelete: () => void;
  onCancel: () => void;
}

function createMaterialIcon(name: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "material-icons point-action-dialog__icon-glyph";
  icon.textContent = name;
  return icon;
}

export function createPointActionDialogElement({
  onDelete,
  onCancel,
}: PointActionDialogHandlers): HTMLElement {
  const root = document.createElement("div");
  root.className = "point-action-dialog";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "point-action-dialog__delete-btn";
  deleteButton.title = "Delete";
  deleteButton.append(createMaterialIcon("delete"));
  deleteButton.addEventListener("click", onDelete);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "point-action-dialog__cancel-btn";
  cancelButton.title = "Cancel";
  cancelButton.append(createMaterialIcon("close"));
  cancelButton.addEventListener("click", onCancel);

  root.append(deleteButton, cancelButton);

  return root;
}
