// 跟随宿主主题令牌，避免系统深色偏好覆盖 DSH 手动选择的外观。
export const CSS = `
.btw-dock{display:flex;flex:none;flex-direction:column;gap:8px;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;max-height:440px;overflow:auto;padding:4px 0 10px;box-sizing:border-box;letter-spacing:0}
.btw-bubble{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex-shrink:0;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0}
.btw-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px}
.btw-symbol{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);height:28px;flex-shrink:0}
.btw-question{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px;max-height:66px;overflow:auto}
.btw-actions{display:flex;gap:4px;flex-shrink:0}
.btw-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease}
.btw-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.btw-actions button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}
.btw-actions button:disabled{cursor:wait;opacity:.5}
.btw-status{display:flex;align-items:center;gap:8px;padding:0 14px 12px;color:var(--dsw-alias-label-secondary);font-size:13px}
.btw-spinner{animation:btw-spin 1.2s linear infinite}@keyframes btw-spin{to{transform:rotate(360deg)}}
.btw-answer{padding:0 14px 14px;max-height:300px;overflow:auto;overflow-wrap:anywhere;font-size:13px;line-height:1.7}
.btw-answer>*:first-child{margin-top:0}.btw-answer>*:last-child{margin-bottom:0}
.btw-answer p{margin:8px 0}.btw-answer h1,.btw-answer h2,.btw-answer h3{font-size:15px;line-height:1.5;margin:12px 0 6px;font-weight:600}
.btw-answer pre{max-width:100%;overflow:auto;background:var(--dsw-alias-markdown-code-block);padding:10px;border-radius:8px;white-space:pre;font-size:12px}
.btw-answer code{font-family:Consolas,monospace;font-size:12px}.btw-answer :not(pre)>code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:1px 3px}.btw-answer a{color:var(--dsw-alias-label-primary);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
.btw-answer table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.btw-answer th,.btw-answer td{border:1px solid var(--dsw-alias-border-l2);padding:5px 9px}
.btw-answer ul,.btw-answer ol{padding-left:22px}.btw-answer blockquote{margin:8px 0;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-secondary)}
.btw-error{margin:0;padding:0 14px 12px;font-size:13px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}
@media(max-width:480px){.btw-dock{max-height:330px}.btw-header{padding:6px 8px 6px 12px;gap:6px}.btw-answer{padding:0 12px 12px;max-height:230px}.btw-status,.btw-error{padding-left:12px}.btw-actions{gap:0}.btw-actions button{width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.btw-spinner{animation:none}.btw-actions button{transition:none}}
`
