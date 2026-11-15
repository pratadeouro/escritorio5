import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Eraser,
  FileUp,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Palette,
  Plus,
  Printer,
  Quote,
  Redo2,
  Rows3,
  Columns3,
  SeparatorHorizontal,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  downloadDocx,
  htmlToPlainText,
  importDocxToHtml,
  normalizeContentToHtml,
  printHtmlDocument
} from '../utils/docxUtils';

export interface WordDocumentEditorHandle {
  insertVariable: (variableName: string) => void;
  setHtmlContent: (html: string) => void;
  getHtmlContent: () => string;
}

interface WordDocumentEditorProps {
  value: string;
  onChange: (html: string) => void;
  documentKey?: string;
  documentTitle?: string;
  placeholder?: string;
  onImportDocx?: (payload: { fileName: string; html: string; warnings: string[] }) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

const FONT_FAMILIES = [
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, Segoe UI, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, Baskerville, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' }
];

const FONT_SIZES = ['10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt', '24pt'];

const LINE_HEIGHTS = [
  { label: '1,0 (Simples)', value: '1.0' },
  { label: '1,15', value: '1.15' },
  { label: '1,5 (ABNT)', value: '1.5' },
  { label: '2,0 (Duplo)', value: '2.0' }
];

const HIGHLIGHT_SWATCHES = [
  { label: 'Amarelo', color: '#fef08a' },
  { label: 'Verde', color: '#bbf7d0' },
  { label: 'Azul', color: '#bfdbfe' },
  { label: 'Rosa', color: '#fecdd3' }
];

const ZOOM_LEVELS = [
  { label: '80%', scaleClass: 'scale-[0.8] origin-top' },
  { label: '100%', scaleClass: 'scale-100 origin-top' },
  { label: '115%', scaleClass: 'scale-[1.15] origin-top' }
];

const WordDocumentEditor = forwardRef<WordDocumentEditorHandle, WordDocumentEditorProps>(
  (
    {
      value,
      onChange,
      documentKey = 'default',
      documentTitle = 'Documento',
      placeholder = 'Comece a redigir seu modelo jurídico ou clique em "Importar .docx" para carregar um arquivo do Word...',
      onImportDocx,
      onNotify
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastLoadedKeyRef = useRef<string>(documentKey);
    const isInternalUpdateRef = useRef(false);

    const [zoomIndex, setZoomIndex] = useState<number>(1);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showHighlightMenu, setShowHighlightMenu] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [, setSelectionTick] = useState(0);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: {
              rel: 'noopener noreferrer',
              target: '_blank'
            }
          }
        }),
        TextStyleKit,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          defaultAlignment: 'justify'
        }),
        TableKit.configure({
          table: {
            resizable: true
          }
        }),
        Placeholder.configure({
          placeholder
        })
      ],
      content: normalizeContentToHtml(value),
      onUpdate: ({ editor: ed }) => {
        isInternalUpdateRef.current = true;
        onChange(ed.getHTML());
      },
      onSelectionUpdate: () => {
        setSelectionTick(t => t + 1);
      },
      onTransaction: () => {
        setSelectionTick(t => t + 1);
      }
    });

    // Reload editor content when switching documents or resetting the editor externally
    useEffect(() => {
      if (!editor) return;

      if (lastLoadedKeyRef.current !== documentKey) {
        lastLoadedKeyRef.current = documentKey;
        const normalized = normalizeContentToHtml(value);
        editor.commands.setContent(normalized, { emitUpdate: false });
        return;
      }

      if (isInternalUpdateRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }

      const currentHtml = editor.getHTML();
      if (!value && currentHtml !== '<p style="text-align: justify"></p>' && editor.getText().trim() !== '') {
        editor.commands.setContent('<p style="text-align: justify"></p>', { emitUpdate: false });
      }
    }, [value, documentKey, editor]);

    useImperativeHandle(
      ref,
      () => ({
        insertVariable: (variableName: string) => {
          if (!editor) return;
          editor.chain().focus().insertContent(variableName).run();
        },
        setHtmlContent: (html: string) => {
          if (!editor) return;
          const normalized = normalizeContentToHtml(html);
          editor.commands.setContent(normalized, { emitUpdate: true });
        },
        getHtmlContent: () => {
          return editor ? editor.getHTML() : value;
        }
      }),
      [editor, value]
    );

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.docx')) {
        onNotify?.('error', 'Selecione um arquivo do Microsoft Word no formato .docx.');
        return;
      }

      setIsImporting(true);
      try {
        const { html, warnings } = await importDocxToHtml(file);
        if (editor) {
          editor.commands.setContent(html, { emitUpdate: true });
          editor.commands.focus('start');
        } else {
          onChange(html);
        }
        onImportDocx?.({ fileName: file.name, html, warnings });
        onNotify?.('success', `Arquivo "${file.name}" importado para a folha de edição.`);
      } catch (err: any) {
        onNotify?.('error', `Não foi possível ler o arquivo .docx: ${err?.message || 'formato inválido'}.`);
      } finally {
        setIsImporting(false);
      }
    };

    const handleDownloadDocx = async () => {
      const html = editor ? editor.getHTML() : value;
      setIsExporting(true);
      try {
        await downloadDocx(html, documentTitle || 'Documento_Juridico');
        onNotify?.('success', 'Arquivo .docx gerado e baixado com sucesso.');
      } catch (err: any) {
        onNotify?.('error', `Erro ao exportar .docx: ${err?.message || 'falha na geração'}.`);
      } finally {
        setIsExporting(false);
      }
    };

    const handlePrint = () => {
      const html = editor ? editor.getHTML() : value;
      printHtmlDocument(documentTitle || 'Documento', html);
    };

    const applyBlockStyle = (styleValue: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (styleValue) {
        case 'h1':
          chain.setHeading({ level: 1 }).run();
          break;
        case 'h2':
          chain.setHeading({ level: 2 }).run();
          break;
        case 'h3':
          chain.setHeading({ level: 3 }).run();
          break;
        case 'blockquote':
          chain.toggleBlockquote().run();
          break;
        default:
          if (editor.isActive('blockquote')) {
            chain.toggleBlockquote().setParagraph().run();
          } else {
            chain.setParagraph().run();
          }
          break;
      }
    };

    const currentBlockStyle = !editor
      ? 'p'
      : editor.isActive('heading', { level: 1 })
      ? 'h1'
      : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : editor.isActive('blockquote')
      ? 'blockquote'
      : 'p';

    const textStyleAttrs = editor?.getAttributes('textStyle') || {};
    const currentFontFamily = textStyleAttrs.fontFamily || 'Times New Roman, serif';
    const currentFontSize = textStyleAttrs.fontSize || '12pt';
    const currentLineHeight = textStyleAttrs.lineHeight || '1.5';
    const currentColor = textStyleAttrs.color || '#111827';

    const plainText = editor ? editor.getText() : htmlToPlainText(value);
    const charCount = plainText.length;
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    const isInsideTable = Boolean(editor?.isActive('table'));

    const applyLink = () => {
      if (!editor) return;
      const trimmed = linkUrl.trim();
      if (!trimmed) {
        editor.chain().focus().unsetLink().run();
      } else {
        const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      }
      setShowLinkInput(false);
      setLinkUrl('');
    };

    return (
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[760px]">
        {/* Hidden .docx input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* WORD RIBBON - ROW 1: File Actions (.docx) & Typography */}
        <div className="bg-app-bg px-3 py-2 border-b border-app-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-2.5 py-1.5 bg-app-surface hover:bg-primary/10 text-app-text hover:text-primary border border-app-border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Carregar um arquivo Microsoft Word (.docx) para editar"
            >
              <FileUp size={14} className="text-primary" />
              <span>{isImporting ? 'Importando...' : 'Importar .docx'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Exportar documento atual no formato Microsoft Word (.docx)"
            >
              <Download size={14} />
              <span>{isExporting ? 'Gerando...' : 'Baixar .docx'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-app-surface hover:bg-app-border text-app-text border border-app-border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Imprimir folha A4 ou salvar como PDF"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>

            <div className="h-5 w-px bg-app-border mx-0.5 hidden sm:block" />

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              className="p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-surface disabled:opacity-35 transition-colors"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              className="p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-surface disabled:opacity-35 transition-colors"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
          </div>

          {/* Style, Font Family, Font Size, Line Height */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Estilo do parágrafo"
              value={currentBlockStyle}
              onChange={(e) => applyBlockStyle(e.target.value)}
              className="px-2 py-1 bg-app-surface border border-app-border rounded-md text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="p">Parágrafo Normal</option>
              <option value="h1">Título 1 (Principal)</option>
              <option value="h2">Título 2 (Seção)</option>
              <option value="h3">Título 3 (Subtópico)</option>
              <option value="blockquote">Citação Jurídica (Recuo ABNT)</option>
            </select>

            <select
              aria-label="Família da fonte"
              value={currentFontFamily}
              onChange={(e) => editor?.chain().focus().setFontFamily(e.target.value).run()}
              className="px-2 py-1 bg-app-surface border border-app-border rounded-md text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary max-w-[145px]"
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Tamanho da fonte"
              value={currentFontSize}
              onChange={(e) => editor?.chain().focus().setFontSize(e.target.value).run()}
              className="px-2 py-1 bg-app-surface border border-app-border rounded-md text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            >
              {FONT_SIZES.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <select
              aria-label="Espaçamento entre linhas"
              value={currentLineHeight}
              onChange={(e) => editor?.chain().focus().setLineHeight(e.target.value).run()}
              className="px-2 py-1 bg-app-surface border border-app-border rounded-md text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
              title="Espaçamento entre linhas"
            >
              {LINE_HEIGHTS.map(lh => (
                <option key={lh.value} value={lh.value}>
                  Esp. {lh.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* WORD RIBBON - ROW 2: Formatting, Alignment, Lists, Tables & Zoom */}
        <div className="bg-app-surface px-3 py-1.5 border-b border-app-border flex flex-wrap items-center justify-between gap-2 relative">
          <div className="flex flex-wrap items-center gap-0.5">
            {/* Inline Marks */}
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('bold')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Negrito (Ctrl+B)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('italic')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Itálico (Ctrl+I)"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('underline')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Sublinhado (Ctrl+U)"
            >
              <UnderlineIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('strike')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Tachado"
            >
              <Strikethrough size={15} />
            </button>

            {/* Text Color */}
            <label
              className="p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-bg transition-colors cursor-pointer flex items-center relative"
              title="Cor da fonte"
            >
              <Palette size={15} />
              <input
                type="color"
                value={currentColor.startsWith('#') ? currentColor : '#111827'}
                onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                className="sr-only"
              />
            </label>

            {/* Highlight Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHighlightMenu(prev => !prev)}
                className={`p-1.5 rounded-md transition-colors ${
                  editor?.isActive('highlight')
                    ? 'bg-amber-400/25 text-amber-600 dark:text-amber-400'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
                }`}
                title="Realce de texto (Marca-texto)"
              >
                <Highlighter size={15} />
              </button>
              {showHighlightMenu && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-app-surface border border-app-border rounded-lg shadow-lg p-2 flex items-center gap-1.5">
                  {HIGHLIGHT_SWATCHES.map(sw => (
                    <button
                      key={sw.color}
                      type="button"
                      onClick={() => {
                        editor?.chain().focus().toggleHighlight({ color: sw.color }).run();
                        setShowHighlightMenu(false);
                      }}
                      className="px-2 py-1 rounded text-[11px] font-medium text-zinc-900 border border-zinc-300 hover:opacity-85"
                      title={sw.label}
                    >
                      {sw.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().unsetHighlight().run();
                      setShowHighlightMenu(false);
                    }}
                    className="px-2 py-1 rounded text-[11px] text-app-text-muted hover:bg-app-bg border border-app-border"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              className="p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-bg transition-colors"
              title="Limpar formatação selecionada"
            >
              <Eraser size={15} />
            </button>

            <div className="h-4 w-px bg-app-border mx-1" />

            {/* Alignment */}
            <button
              type="button"
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive({ textAlign: 'left' })
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Alinhar à esquerda"
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive({ textAlign: 'center' })
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Centralizar"
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive({ textAlign: 'right' })
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Alinhar à direita"
            >
              <AlignRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive({ textAlign: 'justify' })
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Justificar texto (Padrão Jurídico)"
            >
              <AlignJustify size={15} />
            </button>

            <div className="h-4 w-px bg-app-border mx-1" />

            {/* Lists, Quote, Link, Page Break */}
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('bulletList')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Lista com marcadores"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('orderedList')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Lista numerada"
            >
              <ListOrdered size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('blockquote')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Recuo de citação jurídica (ABNT)"
            >
              <Quote size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              className="p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-bg transition-colors"
              title="Inserir quebra de página / separador"
            >
              <SeparatorHorizontal size={15} />
            </button>

            {/* Link Popover */}
            <button
              type="button"
              onClick={() => {
                const prevHref = editor?.getAttributes('link')?.href || '';
                setLinkUrl(prevHref);
                setShowLinkInput(prev => !prev);
              }}
              className={`p-1.5 rounded-md transition-colors ${
                editor?.isActive('link')
                  ? 'bg-primary/15 text-primary'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Inserir ou editar hiperlink"
            >
              <LinkIcon size={15} />
            </button>
            {editor?.isActive('link') && (
              <button
                type="button"
                onClick={() => editor?.chain().focus().unsetLink().run()}
                className="p-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Remover link"
              >
                <Unlink size={14} />
              </button>
            )}

            <div className="h-4 w-px bg-app-border mx-1" />

            {/* Table Insertion & Contextual Controls */}
            <button
              type="button"
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                isInsideTable
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title="Inserir tabela 3x3"
            >
              <TableIcon size={14} />
              <span className="hidden xl:inline">Tabela</span>
            </button>

            {isInsideTable && (
              <div className="flex items-center gap-0.5 bg-app-bg px-1.5 py-0.5 rounded-md border border-app-border ml-1">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                  className="px-1.5 py-0.5 text-[11px] text-app-text hover:text-primary flex items-center gap-0.5 rounded hover:bg-app-surface"
                  title="Adicionar linha abaixo"
                >
                  <Rows3 size={12} />
                  <Plus size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                  className="px-1.5 py-0.5 text-[11px] text-app-text hover:text-rose-500 flex items-center gap-0.5 rounded hover:bg-app-surface"
                  title="Remover linha atual"
                >
                  <Rows3 size={12} />
                  <Minus size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                  className="px-1.5 py-0.5 text-[11px] text-app-text hover:text-primary flex items-center gap-0.5 rounded hover:bg-app-surface"
                  title="Adicionar coluna à direita"
                >
                  <Columns3 size={12} />
                  <Plus size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                  className="px-1.5 py-0.5 text-[11px] text-app-text hover:text-rose-500 flex items-center gap-0.5 rounded hover:bg-app-surface"
                  title="Remover coluna atual"
                >
                  <Columns3 size={12} />
                  <Minus size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().deleteTable().run()}
                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded"
                  title="Excluir tabela inteira"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Zoom & Word/Char Counters */}
          <div className="flex items-center gap-2 text-xs text-app-text-muted ml-auto">
            <span className="hidden sm:inline tabular-nums text-[11px]">
              {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'} · {charCount} caract.
            </span>
            <div className="flex items-center border border-app-border rounded-md bg-app-bg">
              <button
                type="button"
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex(z => Math.max(0, z - 1))}
                className="p-1 hover:text-app-text disabled:opacity-35"
                title="Reduzir zoom da folha"
              >
                <ZoomOut size={13} />
              </button>
              <span className="px-1.5 text-[11px] font-medium text-app-text tabular-nums">
                {ZOOM_LEVELS[zoomIndex].label}
              </span>
              <button
                type="button"
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                onClick={() => setZoomIndex(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
                className="p-1 hover:text-app-text disabled:opacity-35"
                title="Aumentar zoom da folha"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>

          {/* Inline Link Input Bar (No window.prompt) */}
          {showLinkInput && (
            <div className="w-full pt-1.5 mt-1 border-t border-app-border flex items-center gap-2">
              <span className="text-xs font-medium text-app-text shrink-0">URL do Link:</span>
              <input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === 'Escape') {
                    setShowLinkInput(false);
                  }
                }}
                className="flex-1 px-2.5 py-1 bg-app-bg border border-app-border rounded text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={applyLink}
                className="px-2.5 py-1 bg-primary text-white rounded text-xs font-medium hover:opacity-90"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={() => setShowLinkInput(false)}
                className="px-2 py-1 border border-app-border rounded text-xs text-app-text-muted hover:text-app-text"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Horizontal A4 Ruler Strip */}
        <div className="bg-zinc-200/70 dark:bg-zinc-900 border-b border-app-border px-4 py-1 flex justify-center select-none overflow-hidden">
          <div className="w-full max-w-[21cm] flex items-center justify-between text-[9px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
            <span className="text-zinc-400">| 2,5cm</span>
            <span>| 4</span>
            <span>| 6</span>
            <span>| 8</span>
            <span>| 10</span>
            <span>| 12</span>
            <span>| 14</span>
            <span>| 16</span>
            <span className="text-zinc-400">18,5cm |</span>
          </div>
        </div>

        {/* WORKSPACE DESK + A4 WHITE SHEET */}
        <div
          className="flex-1 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto overflow-x-auto custom-scrollbar p-4 sm:p-8 flex justify-center cursor-text"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              editor?.commands.focus('end');
            }
          }}
        >
          <div className={`transition-transform duration-150 ${ZOOM_LEVELS[zoomIndex].scaleClass}`}>
            <div className="w-[21cm] min-h-[29.7cm] bg-white text-zinc-900 shadow-md border border-zinc-300 dark:border-zinc-700 p-[2.5cm] word-page-content select-text">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

WordDocumentEditor.displayName = 'WordDocumentEditor';

export default WordDocumentEditor;
