// Lightweight toast & confirm dialog utilities (no dependencies)
(function() {
    // Inject styles once
    const style = document.createElement('style');
    style.textContent = `
    .toast-container{position:fixed;top:16px;right:16px;z-index:20000;display:flex;flex-direction:column;gap:10px}
    .toast{min-width:260px;max-width:380px;padding:12px 14px;border-radius:8px;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.15);display:flex;align-items:flex-start;gap:8px;opacity:0;transform:translateY(-8px);animation:toast-in .2s ease-out forwards}
    .toast.info{background:#3b82f6}
    .toast.success{background:#10b981}
    .toast.warn{background:#f59e0b}
    .toast.error{background:#ef4444}
    .toast .title{font-weight:600;margin-bottom:2px}
    .toast .close{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;font-size:16px;opacity:.8}
    @keyframes toast-in{to{opacity:1;transform:translateY(0)}}
    @keyframes toast-out{to{opacity:0;transform:translateY(-8px)}}

    .confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:20001}
    .confirm-dialog{background:#fff;border-radius:10px;width:min(92vw,420px);padding:18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:inherit}
    .confirm-title{font-weight:600;font-size:18px;margin:2px 0 8px 0;color:#111}
    .confirm-message{font-size:14px;color:#333;margin:0 0 14px 0;white-space:pre-wrap}
    .confirm-actions{display:flex;gap:10px;justify-content:flex-end}
    .btn{padding:8px 12px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:14px}
    .btn.secondary{background:#f3f4f6;color:#111;border-color:#e5e7eb}
    .btn.primary{background:#ef4444;color:white}
    `;
    document.head.appendChild(style);

    // Toast container
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(container);
    });

    function showToast(message, type = 'info', title) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <div class="content">
                ${title ? `<div class="title">${title}</div>` : ''}
                <div class="msg">${message}</div>
            </div>
            <button class="close" aria-label="Close">×</button>
        `;
        const closeBtn = el.querySelector('.close');
        const remove = () => {
            el.style.animation = 'toast-out .2s ease-in forwards';
            setTimeout(() => el.remove(), 180);
        };
        closeBtn.addEventListener('click', remove);
        container.appendChild(el);
        const timeout = setTimeout(remove, 3500);
        el.addEventListener('mouseenter', () => clearTimeout(timeout));
    }

    async function confirmDialog({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel' } = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-title">${title}</div>
                    <div class="confirm-message">${message}</div>
                    <div class="confirm-actions">
                        <button class="btn secondary" data-act="cancel">${cancelText}</button>
                        <button class="btn primary" data-act="ok">${confirmText}</button>
                    </div>
                </div>
            `;
            function cleanup(result){
                overlay.remove();
                resolve(result);
            }
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
            overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => cleanup(false));
            overlay.querySelector('[data-act="ok"]').addEventListener('click', () => cleanup(true));
            document.body.appendChild(overlay);
        });
    }

    window.toast = {
        info: (m, t) => showToast(m, 'info', t),
        success: (m, t) => showToast(m, 'success', t),
        warn: (m, t) => showToast(m, 'warn', t),
        error: (m, t) => showToast(m, 'error', t)
    };

    window.confirmDialog = confirmDialog;

    // Override window.alert to use toast (non-blocking)
    const nativeAlert = window.alert;
    window.alert = function(message) {
        try { showToast(String(message), 'info'); } catch (e) { nativeAlert(message); }
    };
})();


