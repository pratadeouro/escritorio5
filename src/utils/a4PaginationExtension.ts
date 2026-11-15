import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';

export interface PageBreakInfo {
  pos: number;
  pageEnding: number;
  fillerPx: number;
}

export interface PaginationState {
  breaks: PageBreakInfo[];
  totalPages: number;
  lastPageFillerPx: number;
}

export interface A4PaginationOptions {
  onPageCountChange?: (totalPages: number) => void;
}

// A4 printable vertical area: 29.7cm total height - 2.5cm top margin - 2.5cm bottom margin = 24.7cm (~932px at 96 DPI)
const PAGE_CONTENT_HEIGHT_PX = 932;

const a4PaginationPluginKey = new PluginKey<PaginationState>('a4Pagination');

function isSamePaginationState(a: PaginationState, b: PaginationState): boolean {
  if (a.totalPages !== b.totalPages) return false;
  if (a.breaks.length !== b.breaks.length) return false;
  if (Math.abs(a.lastPageFillerPx - b.lastPageFillerPx) > 1) return false;

  for (let i = 0; i < a.breaks.length; i++) {
    if (
      a.breaks[i].pos !== b.breaks[i].pos ||
      a.breaks[i].pageEnding !== b.breaks[i].pageEnding ||
      Math.abs(a.breaks[i].fillerPx - b.breaks[i].fillerPx) > 1
    ) {
      return false;
    }
  }
  return true;
}

function createPageBreakElement(
  pageEnding: number,
  totalPages: number,
  fillerPx: number
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'word-a4-page-break';
  wrapper.contentEditable = 'false';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.setProperty('--a4-filler-h', `${fillerPx}px`);

  const filler = document.createElement('div');
  filler.className = 'word-a4-page-filler';

  const bottomMargin = document.createElement('div');
  bottomMargin.className = 'word-a4-page-bottom-margin';
  const footerLabel = document.createElement('span');
  footerLabel.className = 'word-a4-page-number';
  footerLabel.textContent = `Página ${pageEnding} de ${totalPages}`;
  bottomMargin.appendChild(footerLabel);

  const deskGap = document.createElement('div');
  deskGap.className = 'word-a4-page-desk-gap';

  const topMargin = document.createElement('div');
  topMargin.className = 'word-a4-page-top-margin';
  const headerLabel = document.createElement('span');
  headerLabel.className = 'word-a4-page-header-tag';
  headerLabel.textContent = `Folha ${pageEnding + 1}`;
  topMargin.appendChild(headerLabel);

  wrapper.appendChild(filler);
  wrapper.appendChild(bottomMargin);
  wrapper.appendChild(deskGap);
  wrapper.appendChild(topMargin);

  return wrapper;
}

function createLastPageFooterElement(
  totalPages: number,
  lastPageFillerPx: number
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'word-a4-last-page-footer';
  wrapper.contentEditable = 'false';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.setProperty('--a4-filler-h', `${lastPageFillerPx}px`);

  const filler = document.createElement('div');
  filler.className = 'word-a4-page-filler';

  const bottomMargin = document.createElement('div');
  bottomMargin.className = 'word-a4-page-bottom-margin is-last-page';
  const footerLabel = document.createElement('span');
  footerLabel.className = 'word-a4-page-number';
  footerLabel.textContent = `Página ${totalPages} de ${totalPages}`;
  bottomMargin.appendChild(footerLabel);

  wrapper.appendChild(filler);
  wrapper.appendChild(bottomMargin);

  return wrapper;
}

function measurePagination(view: EditorView): PaginationState | null {
  if (!view.dom || !view.dom.isConnected) return null;

  const doc = view.state.doc;
  const breaks: PageBreakInfo[] = [];
  let currentPage = 1;
  let usedHeight = 0;

  doc.forEach((node, offset) => {
    const domNode = view.nodeDOM(offset);
    if (!(domNode instanceof HTMLElement)) return;

    const computed = window.getComputedStyle(domNode);
    const marginBottom = parseFloat(computed.marginBottom) || 0;
    const blockHeight = domNode.offsetHeight + marginBottom;

    // Explicit manual page break (<hr>)
    if (node.type.name === 'horizontalRule') {
      const afterPos = offset + node.nodeSize;
      if (afterPos < doc.content.size) {
        const fillerPx = Math.max(
          0,
          Math.round(PAGE_CONTENT_HEIGHT_PX - (usedHeight + blockHeight))
        );
        breaks.push({
          pos: afterPos,
          pageEnding: currentPage,
          fillerPx
        });
        currentPage += 1;
        usedHeight = 0;
      } else {
        usedHeight += blockHeight;
      }
      return;
    }

    // Automatic page overflow before this block
    if (usedHeight > 0 && usedHeight + blockHeight > PAGE_CONTENT_HEIGHT_PX) {
      const fillerPx = Math.max(0, Math.round(PAGE_CONTENT_HEIGHT_PX - usedHeight));
      breaks.push({
        pos: offset,
        pageEnding: currentPage,
        fillerPx
      });
      currentPage += 1;
      usedHeight = 0;
    }

    usedHeight += blockHeight;

    // Handle single oversized blocks (e.g. very large multi-page tables)
    if (usedHeight > PAGE_CONTENT_HEIGHT_PX) {
      const extraPages = Math.floor(usedHeight / PAGE_CONTENT_HEIGHT_PX);
      const remainder = usedHeight % PAGE_CONTENT_HEIGHT_PX;
      if (remainder === 0) {
        currentPage += Math.max(0, extraPages - 1);
        usedHeight = PAGE_CONTENT_HEIGHT_PX;
      } else {
        currentPage += extraPages;
        usedHeight = remainder;
      }
    }
  });

  const totalPages = Math.max(1, currentPage);
  const lastPageFillerPx = Math.max(0, Math.round(PAGE_CONTENT_HEIGHT_PX - usedHeight));

  return {
    breaks,
    totalPages,
    lastPageFillerPx
  };
}

export const A4PaginationExtension = Extension.create<A4PaginationOptions>({
  name: 'a4Pagination',

  addOptions() {
    return {
      onPageCountChange: undefined
    };
  },

  addProseMirrorPlugins() {
    const onPageCountChange = this.options.onPageCountChange;

    return [
      new Plugin<PaginationState>({
        key: a4PaginationPluginKey,
        state: {
          init() {
            return {
              breaks: [],
              totalPages: 1,
              lastPageFillerPx: PAGE_CONTENT_HEIGHT_PX
            };
          },
          apply(tr, prev) {
            const nextMeta = tr.getMeta(a4PaginationPluginKey) as PaginationState | undefined;
            if (nextMeta) {
              return nextMeta;
            }
            if (!tr.docChanged || prev.breaks.length === 0) {
              return prev;
            }
            // Map break positions synchronously through edits until rAF re-measures
            const mappedBreaks = prev.breaks
              .map(b => ({
                ...b,
                pos: tr.mapping.map(b.pos)
              }))
              .filter(b => b.pos > 0 && b.pos <= tr.doc.content.size);

            return {
              ...prev,
              breaks: mappedBreaks
            };
          }
        },
        props: {
          decorations(state) {
            const pState = a4PaginationPluginKey.getState(state);
            if (!pState) return DecorationSet.empty;

            const decos: Decoration[] = [];

            for (const brk of pState.breaks) {
              if (brk.pos >= 0 && brk.pos <= state.doc.content.size) {
                decos.push(
                  Decoration.widget(
                    brk.pos,
                    () =>
                      createPageBreakElement(
                        brk.pageEnding,
                        pState.totalPages,
                        brk.fillerPx
                      ),
                    {
                      side: -1,
                      ignoreSelection: true,
                      key: `a4-brk-${brk.pageEnding}-${pState.totalPages}-${brk.fillerPx}`
                    }
                  )
                );
              }
            }

            // Final page bottom filler & footer so every page has exact 29.7cm height
            decos.push(
              Decoration.widget(
                state.doc.content.size,
                () =>
                  createLastPageFooterElement(
                    pState.totalPages,
                    pState.lastPageFillerPx
                  ),
                {
                  side: 1,
                  ignoreSelection: true,
                  key: `a4-end-${pState.totalPages}-${pState.lastPageFillerPx}`
                }
              )
            );

            return DecorationSet.create(state.doc, decos);
          }
        },
        view(editorView) {
          let rafId: number | null = null;
          let lastReportedPages = 0;

          const scheduleMeasure = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
              rafId = null;
              if (!editorView.dom || !editorView.dom.isConnected) return;

              const measured = measurePagination(editorView);
              if (!measured) return;

              if (measured.totalPages !== lastReportedPages) {
                lastReportedPages = measured.totalPages;
                onPageCountChange?.(measured.totalPages);
              }

              const prev = a4PaginationPluginKey.getState(editorView.state);
              if (!prev || !isSamePaginationState(prev, measured)) {
                const tr = editorView.state.tr
                  .setMeta(a4PaginationPluginKey, measured)
                  .setMeta('addToHistory', false);
                editorView.dispatch(tr);
              }
            });
          };

          scheduleMeasure();

          let resizeObserver: ResizeObserver | null = null;
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
              scheduleMeasure();
            });
            resizeObserver.observe(editorView.dom);
          }

          return {
            update(view, prevState) {
              if (!view.state.doc.eq(prevState.doc)) {
                scheduleMeasure();
              }
            },
            destroy() {
              if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
              }
              resizeObserver?.disconnect();
            }
          };
        }
      })
    ];
  }
});
