const Mainloop = imports.mainloop;

let windowAddedIds = [];
let workspaceAddedId;
let monitorsChangedId;
let monitors = [];

/* helper */
function getPointer() {
    let [x, y, mask] = global.get_pointer();

    return {
        x: x,
        y: y
    }
}

function containsPoint(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function getActiveMonitor() {
    return getMonitor(getPointer());
}

function getMonitor(point) {
    let monitor;
    for (var i = 0; i < monitors.length; i++) {
        monitor = monitors[i];
        if (containsPoint(monitor, point)) {
            return monitor;
        }
    }

    return null;
}

function getWindowMonitor(window) {
    let rect = window.get_outer_rect();
    let point = {
        x: rect.x + Math.floor(rect.width / 2),
        y: rect.y + Math.floor(rect.height / 2)
    };

    return getMonitor(point);
}

/* place window */
function placeWindow(window) {
    let activeMonitor = getActiveMonitor();
    let windowMonitor = getWindowMonitor(window);

    if (activeMonitor == null || windowMonitor == null) {
        return;
    }

    if (activeMonitor.id !== windowMonitor.id) {
        //0 = Normal Window, 3 = (non-modal) dialog
        if (window.get_window_type() == 0 || window.get_window_type() == 3) {
            let windowRect = window.get_outer_rect();

            //relative window position to containing monitor
            let relativeWindowPos = {
                x: windowRect.x - windowMonitor.x,
                y: windowRect.y - windowMonitor.y
            };

            //calculate new window position in target monitor
            let targetPos = {
                x: activeMonitor.x + relativeWindowPos.x,
                y: activeMonitor.y + relativeWindowPos.y
            };

            if (window.decorated) {
                window.move_frame(true, targetPos.x, targetPos.y);
            } else {
                window.move(true, targetPos.x, targetPos.y);
            }
        }
    }
}

/* callback handler */
function connectWindowAdded() {
    disconnectWindowAdded();

    let workspace;
    for (let i = 0; i < global.screen.n_workspaces; i++) {
        workspace = global.screen.get_workspace_by_index(i);
        windowAddedIds.push(workspace.connect('window-added', onWindowAdded));
    }
}

function disconnectWindowAdded() {
    let workspace;
    for (let i = 0; i < global.screen.n_workspaces; i++) {
        workspace = global.screen.get_workspace_by_index(i);
        workspace.disconnect(windowAddedIds[i]);
    }
    windowAddedIds = [];
}

function onWorkspaceAdded() {
    connectWindowAdded();
}

function onMonitorsChanged() {
    monitors = [];
    let numMonitors = global.screen.get_n_monitors();
    for (let i = 0; i < numMonitors; i++) {
        monitors[i] = global.screen.get_monitor_geometry(i);
        monitors[i].id = i;
    }

    monitors.sort(function(a, b) {
        return a.x - b.x;
    });
}

function onWindowAdded(workspace, window) {
    let actor = window.get_compositor_private();
    if (!actor) {
        Mainloop.idle_add(function() {
            placeWindow(window);
        });
    } else {
        placeWindow(window);
    }
}

/* extension API */
function init(metadata) {
}

function enable() {
    onMonitorsChanged();
    onWorkspaceAdded();

    workspaceAddedId = global.screen.connect('workspace-added', onWorkspaceAdded);
    monitorsChangedId = global.screen.connect('monitors-changed', onMonitorsChanged);
}

function disable() {
    global.screen.disconnect(workspaceAddedId);
    global.screen.disconnect(monitorsChangedId);
    disconnectWindowAdded();
}
