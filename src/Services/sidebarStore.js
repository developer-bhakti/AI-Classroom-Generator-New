const listeners = new Set();
let isOpen = false;

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

export const sidebarStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return isOpen;
  },
  open() {
    isOpen = true;
    emitChange();
  },
  close() {
    isOpen = false;
    emitChange();
  },
  toggle() {
    isOpen = !isOpen;
    emitChange();
  }
};
