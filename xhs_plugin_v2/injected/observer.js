import { isXHSUrl, dispatchInterceptEvent } from './utils.js';

function observeDOM() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                // 检查新的script标签
                if (node.tagName === 'SCRIPT' && node.src && isXHSUrl(node.src)) {
                    dispatchInterceptEvent({
                        url: node.src,
                        method: 'GET',
                        headers: {},
                        body: null,
                        type: 'script'
                    });
                }
                
                // 检查新添加的元素中的script标签
                const scripts = node.querySelectorAll('script[src]');
                scripts.forEach(function(script) {
                    if (isXHSUrl(script.src)) {
                        dispatchInterceptEvent({
                            url: script.src,
                            method: 'GET',
                            headers: {},
                            body: null,
                            type: 'script'
                        });
                    }
                });
            });
        });
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
}

export { observeDOM }; 