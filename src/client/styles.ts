// 跟随宿主主题令牌，避免系统深色偏好覆盖 DSH 手动选择的外观。
export const CSS = `
.btw-reference-preview{display:block;margin-top:6px;max-height:3.2em;overflow:hidden;overflow-wrap:anywhere;line-height:1.6;color:var(--dsw-alias-label-primary)}
.btw-selection-dialog,.btw-selection-menu{position:fixed;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.btw-selection-menu{margin:0;width:max-content;max-width:calc(100vw - 16px);padding:0;inset:auto;border-radius:var(--dsw-radius-md,8px);overflow:hidden;border:1px solid var(--dsw-alias-border-l1);font-family:inherit;font-size:12px;font-weight:500;line-height:16px;box-shadow:var(--dsw-shadow-lv1,0 2px 8px rgba(0,0,0,0.12))}
.btw-selection-menu [role="toolbar"]{display:flex;align-items:center}
.btw-selection-menu button{display:inline-flex;align-items:center;height:28px;min-height:28px;padding:0 8px;border:0;border-radius:0;text-align:left;white-space:nowrap;background:transparent;color:inherit;font:inherit;cursor:pointer}
.btw-selection-menu button+button{border-left:1px solid var(--dsw-alias-border-l1)}
.btw-selection-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.btw-selection-menu :focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}
.btw-selection-modal{max-width:min(520px,calc(100vw - 32px))!important}
.btw-selection-label{display:flex;flex-direction:column;gap:8px;margin-top:12px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.btw-selection-modal textarea{box-sizing:border-box;width:100%;min-height:96px;resize:vertical;font:inherit;font-size:13px;line-height:1.5;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.btw-selection-modal textarea:focus{border-color:var(--dsw-alias-state-business-primary);outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}
.btw-selection-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px}
.btw-selection-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:10px 4px}
.btw-reference{padding:0 14px 10px;font-size:12px}
.btw-reference summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}
.btw-reference blockquote{margin:8px 0 0;padding:8px;border-left:2px solid var(--dsw-alias-border-l2);white-space:pre-wrap;overflow-wrap:anywhere;max-height:150px;overflow:auto}
.btw-selection-modal .btw-reference{padding:0}
.btw-dock{display:flex;flex:none;flex-direction:column;gap:8px;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;max-height:440px;overflow:auto;padding:4px 0 10px;box-sizing:border-box;letter-spacing:0}
.btw-bubble{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex-shrink:0;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0}
.btw-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px}
.btw-symbol{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);height:28px;flex-shrink:0}
.btw-question{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px;max-height:66px;overflow:auto}
.btw-actions{display:flex;gap:4px;flex-shrink:0}
.btw-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease}
.btw-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.btw-actions button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}
.btw-actions button.btw-action-stop{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.btw-actions button.btw-action-stop:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.btw-actions button:disabled{cursor:wait;opacity:.5}
.btw-status{display:flex;align-items:center;gap:8px;padding:0 14px 12px;color:var(--dsw-alias-label-secondary);font-size:13px}
.btw-spinner{animation:btw-spin 1.2s linear infinite}@keyframes btw-spin{to{transform:rotate(360deg)}}
.btw-answer{padding:0 14px 14px;max-height:300px;overflow:auto;overflow-wrap:anywhere;font-size:13px;line-height:1.7}
.btw-answer>*:first-child{margin-top:0}.btw-answer>*:last-child{margin-bottom:0}
.btw-answer p{margin:8px 0}.btw-answer h1,.btw-answer h2,.btw-answer h3{font-size:15px;line-height:1.5;margin:12px 0 6px;font-weight:600}
.btw-answer pre{max-width:100%;overflow:auto;background:var(--dsw-alias-markdown-code-block);padding:10px;border-radius:8px;white-space:pre;font-size:12px}.btw-answer .katex-display{max-width:100%;overflow:auto}
.btw-answer code{font-family:Consolas,monospace;font-size:12px}.btw-answer :not(pre)>code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:1px 3px}.btw-answer a{color:var(--dsw-alias-label-primary);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
.btw-answer table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.btw-answer th,.btw-answer td{border:1px solid var(--dsw-alias-border-l2);padding:5px 9px}
.btw-answer ul,.btw-answer ol{padding-left:22px}.btw-answer blockquote{margin:8px 0;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-secondary)}
.btw-error{margin:0;padding:0 14px 12px;font-size:13px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}
.btw-quote-dock{position:relative;display:flex;flex-direction:column;align-items:flex-start;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;padding:4px 0 6px;box-sizing:border-box}
.btw-codex-pill{display:inline-flex;align-items:center;height:28px;padding:0 4px 0 10px;gap:6px;border-radius:9999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-shadow-lv1,0 1px 3px rgba(0,0,0,0.06));font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color 140ms ease,border-color 140ms ease;-webkit-user-select:none;user-select:none}
.btw-codex-pill:hover,.btw-codex-pill.btw-codex-pill-active{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}
.btw-codex-pill:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.btw-codex-pill-icon{display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary);flex-shrink:0}
.btw-codex-pill-label{font-size:12px;line-height:1;font-weight:500}
.btw-codex-pill-remove{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:14px;cursor:pointer;line-height:1;margin-left:2px;transition:background-color 120ms ease,color 120ms ease}
.btw-codex-pill-remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.btw-codex-popover{position:absolute;bottom:calc(100% + 6px);left:0;z-index:40;width:min(400px,calc(100vw - 32px));background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 12px 36px rgba(0,0,0,0.22));padding:12px;box-sizing:border-box}
.btw-codex-popover-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l3)}
.btw-codex-popover-title-group{display:inline-flex;align-items:center;gap:6px}
.btw-codex-popover-icon{display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}
.btw-codex-popover-title-text{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1}
.btw-codex-count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:var(--dsw-alias-interactive-bg-hover);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;line-height:1}
.btw-codex-popover-actions{display:flex;align-items:center;gap:6px}
.btw-codex-action-btn{font:inherit;font-size:11px;padding:3px 8px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;line-height:1.2;transition:background-color 120ms ease}
.btw-codex-action-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.btw-codex-popover-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;max-height:260px;overflow:auto}
.btw-codex-comment-card{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:8px 10px;box-sizing:border-box}
.btw-codex-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.btw-codex-tag-badge{display:inline-flex;align-items:center;font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);padding:1px 6px;border-radius:4px;border:1px solid var(--dsw-alias-border-l3)}
.btw-codex-card-remove{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;line-height:1}
.btw-codex-card-remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.btw-codex-card-body{cursor:pointer;border-radius:4px}
.btw-codex-card-body:hover{opacity:0.85}
.btw-codex-card-body blockquote{margin:0;padding-left:8px;border-left:2px solid var(--dsw-alias-border-l2);font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:96px;overflow:hidden}
.btw-anchor-highlight{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;animation:btw-pulse 1.6s ease-out}
@keyframes btw-pulse{0%{background-color:var(--dsw-alias-interactive-bg-hover-accent,rgba(59,130,246,0.2))}100%{background-color:transparent}}
@media(max-width:480px){.btw-dock{max-height:330px}.btw-header{padding:6px 8px 6px 12px;gap:6px}.btw-answer{padding:0 12px 12px;max-height:230px}.btw-status,.btw-error{padding-left:12px}.btw-actions{gap:0}.btw-actions button{width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.btw-spinner{animation:none}.btw-actions button{transition:none}}
.btw-native-ask-action{corner-shape:round;background:var(--dsw-alias-button-floating-fill);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-13);cursor:pointer;border:none;border-radius:999px;padding:5px 10px;display:inline-flex;align-items:center}
.btw-native-ask-action:focus-visible{background:var(--dsw-alias-button-floating-hover)}
@media(hover:hover){.btw-native-ask-action:hover{background:var(--dsw-alias-button-floating-hover)}}
.btw-official-quote-preview{margin:6px 0;padding:6px 12px;border-left:3px solid var(--dsw-alias-state-business-primary,#2563eb);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.04));border-radius:4px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
`
