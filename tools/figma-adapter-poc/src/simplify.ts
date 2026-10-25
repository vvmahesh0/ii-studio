import type { DesignNode } from "./contract";
const near = (a: number, b: number) => Math.abs(a - b) < 0.1;
function transparent(n: DesignNode) {
    return !n.style.fill?.a && !n.style.stroke?.a && !n.style.shadow && (n.style.opacity ?? 1) === 1 && !n.style.radius;
}
/** Remove only a geometry-identical, non-semantic, unstyled free-layout wrapper.
 * Auto Layout, padding, clipping, absolute and independent sizing survive. */
export function simplifyHierarchy(root: DesignNode): DesignNode {
    function visit(n: DesignNode, isRoot = false): DesignNode {
        n.children = n.children.map(c => visit(c));
        if (!isRoot && n.kind === 'frame' && !/^source:[^/]+$/.test(n.id) && transparent(n) &&
            !n.absolute && n.layout?.axis === 'none' && !n.layout.clip && n.layout.padding.every(p => !p) && n.children.length === 1) {
            const c = n.children[0];
            if (!c.absolute && near(c.x, 0) && near(c.y, 0) && near(c.width, n.width) && near(c.height, n.height)) {
                c.x = n.x;
                c.y = n.y;
                c.sizing = { ...n.sizing };
                return c;
            }
        }
        return n;
    }
    return visit(root, true);
}
/** CSS margins participate in flex layout; Figma has only one shared gap.
 * Infer the real uniform gap, wrapping only unequal positive margin intervals.
 * No guessed compensating offsets. Nonrepresentable overlap stays measured. */
export function reconcileStack(n: DesignNode) {
    const l = n.layout;
    if (!l || l.axis === 'none' || l.justify === 'between')
        return;
    const horizontal = l.axis === 'horizontal', axis = horizontal ? 'x' : 'y', length = horizontal ? 'width' : 'height';
    const children = n.children.filter(c => !c.absolute);
    if (!children.length)
        return;
    const gaps = children.slice(1).map((c, i) => c[axis] - children[i][axis] - children[i][length]);
    if (gaps.some(g => g < -1)) {
        l.axis = 'none';
        return;
    }
    const first = children[0], last = children.at(-1)!;
    const begin = horizontal ? 3 : 0, end = horizontal ? 1 : 2;
    // Unused trailing flex space is not padding. Turning it into padding
    // can exceed the contract limit and prevents reasonable parent resizing.
    if (l.justify === "start")
        l.padding[begin] = Math.max(0, first[axis]);
    if (l.justify === "end")
        l.padding[end] = Math.max(0, n[length] - last[axis] - last[length]);
    if (gaps.length)
        l.gap = Math.max(0, Math.min(...gaps));
    for (let i = 1; i < children.length; i++) {
        const extra = gaps[i - 1] - l.gap;
        if (extra < 0.5)
            continue;
        const child = children[i], index = n.children.indexOf(child);
        const wrapper: DesignNode = { id: child.id + '/margin', name: child.name + ' spacing', kind: 'frame', x: child.x, y: child.y, width: child.width, height: child.height, sizing: { ...child.sizing }, absolute: false, style: {}, layout: { axis: l.axis, padding: [0, 0, 0, 0], gap: 0, align: 'start', justify: 'start', clip: false }, children: [child] };
        wrapper[axis] -= extra;
        wrapper[length] += extra;
        wrapper.layout!.padding[begin] = extra;
        child.x = horizontal ? extra : 0;
        child.y = horizontal ? 0 : extra;
        n.children[index] = wrapper;
    }
}
