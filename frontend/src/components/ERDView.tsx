import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface ERDViewProps {
    mermaids: Array<{ name: string; content: string }>;
    className?: string;
}

export default function ERDView({ mermaids, className }: ERDViewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        // Initialize mermaid with a better theme
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'base',
                themeVariables: {
                    primaryColor: '#e0e7ff', // indigo-100
                    primaryTextColor: '#3730a3', // indigo-900
                    primaryBorderColor: '#818cf8', // indigo-400
                    lineColor: '#64748b', // slate-500
                    secondaryColor: '#f0fdf4', // green-50
                    tertiaryColor: '#fffbeb', // amber-50
                },
                securityLevel: 'loose'
            });
        } catch (e) {
            // ignore if already initialized
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !mermaids || mermaids.length === 0) {
            if (container) container.innerHTML = '';
            return;
        }

        const pickMermaid = (preferType = 'erDiagram') => {
            console.log('[ERDView] Available mermaids:', mermaids.map(m => ({ name: m.name, contentLength: m.content?.length })));

            // 0) Priority: Global ERD
            if (preferType === 'erDiagram') {
                const global = mermaids.find(m => m.name && (m.name === 'erd_all.mmd' || m.name.includes('all') || m.name.includes('global')));
                if (global && global.content) {
                    console.log('[ERDView] Picked global ERD:', global.name);
                    console.log('[ERDView] Global ERD content preview:', global.content.substring(0, 500));
                    return global.content;
                }
            }

            // 1) by file name
            const byName = mermaids.find(m => m.name && m.name.toLowerCase().startsWith(preferType === 'erDiagram' ? 'erd_' : 'class_'));
            if (byName && byName.content) {
                console.log('[ERDView] Picked by name:', byName.name);
                return byName.content;
            }
            // 2) by content
            const byContent = mermaids.find(m => typeof m.content === 'string' && new RegExp(`(^|\\n)\\s*${preferType}\\b`, 'i').test(m.content));
            if (byContent && byContent.content) return byContent.content;
            // 3) fallback to first file
            return mermaids[0].content || null;
        };

        const erMermaid = pickMermaid('erDiagram');
        const classMermaid = (() => {
            // find first class_ or content with classDiagram
            const byName = mermaids.find(m => m.name && m.name.toLowerCase().startsWith('class_'));
            if (byName) return byName.content;
            const byContent = mermaids.find(m => typeof m.content === 'string' && /(^|\n)\s*classDiagram\b/i.test(m.content));
            if (byContent) return byContent.content;
            return null;
        })();

        const escapeHtml = (s: string) =>
            String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        const escapeAndShow = (text: string, errMsg?: string) => {
            container.innerHTML = `<pre>${escapeHtml(text)}</pre>` + (errMsg ? `<div class="text-sm text-red-600 mt-2">Mermaid render error: ${escapeHtml(errMsg)}</div>` : '');
        };

        const tryRender = async (content: string | null) => {
            if (!content) return false;

            // Clear container first to avoid ID conflicts or stale content
            container.innerHTML = '';

            try {
                // attempt parse first
                if ((mermaid as any).parse && typeof (mermaid as any).parse === 'function') {
                    try {
                        await (mermaid as any).parse(content);
                    } catch (parseErr) {
                        throw parseErr;
                    }
                }

                // Unique ID for every render to prevent caching issues
                const id = `mermaid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // render
                if (typeof (mermaid as any).render === 'function') {
                    const r = (mermaid as any).render(id, content);
                    if (r && typeof r.then === 'function') {
                        const resolved = await r;
                        const svg = typeof resolved === 'string' ? resolved : resolved?.svg || resolved?.rendered || '';
                        if (!svg) throw new Error('Mermaid.render returned no svg');
                        container.innerHTML = svg;
                        return true;
                    } else if (typeof r === 'string') {
                        container.innerHTML = r;
                        return true;
                    }
                }

                // fallback to mermaidAPI
                if ((mermaid as any).mermaidAPI && typeof (mermaid as any).mermaidAPI.render === 'function') {
                    const apiRes = await (mermaid as any).mermaidAPI.render(id, content);
                    const svg = apiRes && (apiRes.svg || apiRes?.rendered || '');
                    if (!svg) throw new Error('mermaidAPI.render returned no svg');
                    container.innerHTML = svg;
                    return true;
                }

                escapeAndShow(content, 'No mermaid renderer available');
                return false;
            } catch (err: any) {
                throw err;
            }
        };

        (async () => {
            setErrorMsg(null);

            // 1) try ER diagram
            try {
                if (erMermaid) {
                    await tryRender(erMermaid);
                    return;
                }
            } catch (err: any) {
                console.warn('erDiagram render failed:', err);
            }

            // 2) try classDiagram fallback
            try {
                if (classMermaid) {
                    await tryRender(classMermaid);
                    return;
                }
            } catch (err: any) {
                console.warn('classDiagram render failed:', err);
            }

            // 3) fallback to raw
            const raw = erMermaid || (mermaids[0] && mermaids[0].content) || '';
            const msg = 'Both erDiagram and classDiagram failed to render; showing raw mermaid.';
            escapeAndShow(raw, msg);
            setErrorMsg(msg);
        })();

    }, [mermaids]);

    return (
        <div className={className}>
            <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-auto" />
        </div>
    );
}
