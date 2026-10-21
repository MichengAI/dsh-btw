export interface CapturedSelectionDetails {
    text: string;
    role: 'user' | 'assistant';
    turnIndex?: number;
    element: Element;
}
/** 提取选区及关联出处元数据（角色、轮次、锚点节点）。 */
export declare function captureSelectionDetails(scope: HTMLElement, target: Element): CapturedSelectionDetails | undefined;
/** 仅接入宿主有明确标记的单条正文；未知布局保留浏览器原有行为。 */
export declare function captureSelection(scope: HTMLElement, target: Element): string | undefined;
