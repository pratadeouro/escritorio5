import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import { Processo, Contato } from '../types';
import { generateId } from '../services/googleSheets';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Trash2, 
  Info,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface MappingField {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

const MAPPING_FIELDS: MappingField[] = [
  { key: 'numero', label: 'Número do Processo', description: 'Número único de identificação do processo (CNJ ou outro).', required: true },
  { key: 'clienteNome', label: 'Nome do Cliente', description: 'Nome do cliente associado. Se não existir no sistema, um novo contato será criado.', required: false },
  { key: 'parteContraria', label: 'Parte Contrária', description: 'Nome do réu/autor adverso no processo.', required: false },
  { key: 'tribunal', label: 'Tribunal / Órgão', description: 'Órgão julgador do processo (Ex: TJSP, TRF3, STJ).', required: false },
  { key: 'status', label: 'Status', description: 'Situação do processo (Ativo ou Inativo). Se vazio, assumirá "Ativo".', required: false },
  { key: 'dataDistribuicao', label: 'Data de Distribuição', description: 'Data em que o processo foi iniciado/distribuído.', required: false },
  { key: 'titulo', label: 'Título / Descrição', description: 'Um nome amigável ou resumo para o processo.', required: false },
  { key: 'tipo', label: 'Tipo / Categoria', description: 'Categoria ou classe processual.', required: false },
  { key: 'instancia', label: 'Instância / Grau', description: 'Grau de jurisdição (Ex: 1º Grau, 2º Grau, STJ, STF).', required: false },
  { key: 'classe', label: 'Classe Processual', description: 'Procedimento judicial (Ex: Mandado de Segurança, Procedimento Comum).', required: false },
  { key: 'assunto', label: 'Assunto Principal', description: 'Tema do processo (Ex: Dano Moral, Direito de Família).', required: false },
  { key: 'valorCausa', label: 'Valor da Causa', description: 'Valor financeiro atribuído à causa judicial.', required: false },
  { key: 'link', label: 'Link do Processo', description: 'URL para consulta ou acompanhamento do processo.', required: false },
  { key: 'tags', label: 'Tags / Marcadores', description: 'Etiquetas organizacionais separadas por vírgulas.', required: false },
  { key: 'pasta', label: 'Pasta Física / Código', description: 'Armário, gaveta ou código interno da pasta física.', required: false }
];

const normalizeProcessNumber = (num: string | number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  return num.toString().trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
};

export default function ImportTab() {
  const { state, addProcessos, addContatos, escritorioAtivoId } = useAppContext();
  
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [importReport, setImportReport] = useState<{
    total: number;
    ignoredDuplicatesInSystem: string[];
    ignoredDuplicatesInFile: string[];
    ignoredInvalid: number;
    toImport: any[];
    newContactsCount: number;
  } | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guess mappings based on headers whenever headers change
  useEffect(() => {
    if (headers.length > 0) {
      const guessed: Record<string, string> = {};
      MAPPING_FIELDS.forEach(field => {
        const guess = guessMapping(headers, field.key);
        if (guess) {
          guessed[field.key] = guess;
        }
      });
      setMapping(guessed);
    }
  }, [headers]);

  const guessMapping = (headersList: string[], systemFieldKey: string): string => {
    const norm = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    
    const systemKeywords: Record<string, string[]> = {
      numero: ['numero', 'num', 'processo', 'nproc', 'numeroprocesso', 'nprocesso', 'codigo', 'id', 'idproc', 'cnj'],
      clienteNome: ['cliente', 'client', 'nome', 'nomecliente', 'autor', 'requerente', 'reclamante', 'titular', 'patrocinado'],
      parteContraria: ['partecontraria', 'contraria', 'reu', 're', 'adversaria', 'requerido', 'reclamado', 'adverso', 'parteadversa', 'oponente'],
      tribunal: ['tribunal', 'orgao', 'forum', 'juizo', 'instancia', 'corte', 'instancia'],
      status: ['status', 'situacao', 'estado', 'ativo', 'fase'],
      dataDistribuicao: ['data', 'datadistribuicao', 'distribuicao', 'datacadastro', 'cadastro', 'inicio', 'data_distribuicao'],
      titulo: ['titulo', 'desc', 'descricao', 'nomeprocesso', 'title', 'description', 'resumo'],
      tipo: ['tipo', 'categoria', 'classe', 'assunto'],
      instancia: ['instancia', 'grau', 'inst'],
      classe: ['classe', 'procedimento', 'classe_processual'],
      assunto: ['assunto', 'tema', 'materia', 'fato'],
      valorCausa: ['valor', 'valorcausa', 'valordacausa', 'quantia', 'preco', 'custo', 'montante'],
      link: ['link', 'url', 'site', 'endereco', 'consulta', 'site_processo'],
      tags: ['tag', 'tags', 'etiqueta', 'etiquetas', 'grupo', 'marcadores'],
      pasta: ['pasta', 'arquivador', 'arquivo', 'armario', 'fichario', 'gaveta', 'pasta_fisica']
    };

    const keywords = systemKeywords[systemFieldKey] || [];
    for (const h of headersList) {
      const normalizedHeader = norm(h);
      for (const kw of keywords) {
        if (normalizedHeader === kw || normalizedHeader.includes(kw)) {
          return h;
        }
      }
    }
    return '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      alert('Por favor, envie um arquivo CSV, XLS ou XLSX válido.');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (fileToParse: File) => {
    setIsParsing(true);
    const extension = fileToParse.name.substring(fileToParse.name.lastIndexOf('.')).toLowerCase();

    if (extension === '.csv') {
      Papa.parse(fileToParse, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);
          if (results.errors.length > 0 && results.data.length === 0) {
            alert('Falha ao processar arquivo CSV.');
            return;
          }
          const detectedHeaders = results.meta.fields || [];
          setHeaders(detectedHeaders);
          setRawData(results.data);
          setStep(2);
        },
        error: (err) => {
          setIsParsing(false);
          alert('Erro ao processar CSV: ' + err.message);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          
          setIsParsing(false);
          if (rows.length === 0) {
            alert('A planilha está vazia.');
            return;
          }

          // Gather all unique keys from all rows to capture any sparse headers
          const detectedHeadersSet = new Set<string>();
          rows.forEach((row: any) => {
            Object.keys(row).forEach(key => detectedHeadersSet.add(key));
          });
          const detectedHeaders = Array.from(detectedHeadersSet);

          setHeaders(detectedHeaders);
          setRawData(rows);
          setStep(2);
        } catch (err: any) {
          setIsParsing(false);
          alert('Erro ao processar arquivo Excel: ' + err.message);
        }
      };
      reader.onerror = () => {
        setIsParsing(false);
        alert('Erro ao ler arquivo.');
      };
      reader.readAsArrayBuffer(fileToParse);
    }
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setMapping({});
    setImportReport(null);
    setStep(1);
  };

  const analyzeMapping = () => {
    if (!mapping.numero) {
      alert('O mapeamento do campo "Número do Processo" é obrigatório.');
      return;
    }

    const systemNumbersNormalized = new Set(
      state.processos.map(p => normalizeProcessNumber(p.numero))
    );

    const ignoredDuplicatesInSystem: string[] = [];
    const ignoredDuplicatesInFile: string[] = [];
    let ignoredInvalid = 0;
    const seenInFile = new Set<string>();
    const toImport: any[] = [];
    const newContactsToCreate = new Set<string>();

    const existingContactsNames = new Set(
      state.contatos.map(c => c.nome.trim().toLowerCase())
    );

    rawData.forEach((row, index) => {
      const rawNum = row[mapping.numero];
      if (rawNum === undefined || rawNum === null || rawNum.toString().trim() === '') {
        ignoredInvalid++;
        return;
      }

      const processNum = rawNum.toString().trim();
      const normalizedNum = normalizeProcessNumber(processNum);

      if (systemNumbersNormalized.has(normalizedNum)) {
        ignoredDuplicatesInSystem.push(processNum);
        return;
      }

      if (seenInFile.has(normalizedNum)) {
        ignoredDuplicatesInFile.push(processNum);
        return;
      }

      seenInFile.add(normalizedNum);

      // Extract details
      const parsedRow: any = {
        numero: processNum,
        clienteNome: mapping.clienteNome ? (row[mapping.clienteNome] || '').toString().trim() : '',
        parteContraria: mapping.parteContraria ? (row[mapping.parteContraria] || '').toString().trim() : '',
        tribunal: mapping.tribunal ? (row[mapping.tribunal] || '').toString().trim() : '',
        status: mapping.status ? (row[mapping.status] || '').toString().trim() : '',
        dataDistribuicao: mapping.dataDistribuicao ? (row[mapping.dataDistribuicao] || '').toString().trim() : '',
        titulo: mapping.titulo ? (row[mapping.titulo] || '').toString().trim() : '',
        tipo: mapping.tipo ? (row[mapping.tipo] || '').toString().trim() : '',
        instancia: mapping.instancia ? (row[mapping.instancia] || '').toString().trim() : '',
        classe: mapping.classe ? (row[mapping.classe] || '').toString().trim() : '',
        assunto: mapping.assunto ? (row[mapping.assunto] || '').toString().trim() : '',
        valorCausa: mapping.valorCausa ? parseFloat(row[mapping.valorCausa]) || 0 : 0,
        link: mapping.link ? (row[mapping.link] || '').toString().trim() : '',
        tags: mapping.tags ? (row[mapping.tags] || '').toString().trim() : '',
        pasta: mapping.pasta ? (row[mapping.pasta] || '').toString().trim() : '',
      };

      if (parsedRow.clienteNome && !existingContactsNames.has(parsedRow.clienteNome.toLowerCase())) {
        newContactsToCreate.add(parsedRow.clienteNome);
      }

      toImport.push(parsedRow);
    });

    setImportReport({
      total: rawData.length,
      ignoredDuplicatesInSystem,
      ignoredDuplicatesInFile,
      ignoredInvalid,
      toImport,
      newContactsCount: newContactsToCreate.size
    });

    setStep(3);
  };

  const runImport = async () => {
    if (!importReport) return;
    setIsImporting(true);

    try {
      const activeOfficeId = escritorioAtivoId || '';
      
      // Step 1: Create missing contacts if needed
      const contactMap: Record<string, string> = {}; // Name -> ID
      
      // Load current contacts into mapping
      state.contatos.forEach(c => {
        contactMap[c.nome.trim().toLowerCase()] = c.id;
      });

      const uniqueNewNames = new Set<string>();
      importReport.toImport.forEach(item => {
        if (item.clienteNome) {
          const lowerName = item.clienteNome.toLowerCase();
          if (!contactMap[lowerName]) {
            uniqueNewNames.add(item.clienteNome);
          }
        }
      });

      if (uniqueNewNames.size > 0) {
        const newContacts: Contato[] = Array.from(uniqueNewNames).map(name => {
          const generatedId = generateId('default').toUpperCase();
          const contactId = `CONT_${generatedId}`;
          contactMap[name.toLowerCase()] = contactId;
          
          return {
            id: contactId,
            nome: name,
            telefone: '',
            email: '',
            cpfCnpj: '',
            tipo: 'Cliente',
            escritorioId: activeOfficeId,
            dataCadastro: new Date().toLocaleDateString('pt-BR'),
            observacoes: 'Contato gerado automaticamente na importação de processos.'
          };
        });

        // Add them to the global system via context
        addContatos(newContacts);
      }

      // Step 2: Create processes
      const finalProcessos: Processo[] = importReport.toImport.map(item => {
        const lowerClient = item.clienteNome ? item.clienteNome.toLowerCase() : '';
        const mappedClientId = contactMap[lowerClient] || '';

        // Normalize status to Ativo/Inativo
        let parsedStatus: 'Ativo' | 'Inativo' = 'Ativo';
        const rawStatusLower = item.status.toString().toLowerCase();
        if (rawStatusLower.includes('inat') || rawStatusLower === 'inativo' || rawStatusLower === 'false' || rawStatusLower === '0') {
          parsedStatus = 'Inativo';
        }

        return {
          id: '', // Will be filled dynamically by addProcessos
          idProc: '', // Will be filled dynamically by addProcessos
          numero: item.numero,
          clienteId: mappedClientId,
          parteContraria: item.parteContraria || 'N/D',
          tribunal: item.tribunal || 'Não Informado',
          status: parsedStatus,
          dataDistribuicao: item.dataDistribuicao || new Date().toLocaleDateString('pt-BR'),
          escritorioId: activeOfficeId,
          titulo: item.titulo || `Processo ${item.numero}`,
          tipo: item.tipo || '',
          instancia: item.instancia || '1º Grau',
          classe: item.classe || '',
          assunto: item.assunto || '',
          valorCausa: item.valorCausa || 0,
          link: item.link || '',
          tags: item.tags || '',
          pasta: item.pasta || '',
        };
      });

      addProcessos(finalProcessos);
      setStep(4);
    } catch (error: any) {
      alert('Ocorreu um erro ao importar os processos: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-app-border bg-app-secondary flex items-center justify-between">
        <div className="flex items-center">
          <FileSpreadsheet className="mr-2 text-primary" size={20} />
          <h2 className="font-semibold text-app-text">Importador de Processos de Planilhas</h2>
        </div>
        <div className="text-xs text-app-text-muted">
          Etapa {step} de 4
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Step indicator breadcrumbs */}
        <div className="flex items-center justify-center gap-2 mb-4 text-xs font-medium">
          <span className={`px-2.5 py-1 rounded-full ${step >= 1 ? 'bg-primary text-white font-bold' : 'bg-app-secondary text-app-text-muted'}`}>1. Arquivo</span>
          <ArrowRight size={14} className="text-app-text-muted" />
          <span className={`px-2.5 py-1 rounded-full ${step >= 2 ? 'bg-primary text-white font-bold' : 'bg-app-secondary text-app-text-muted'}`}>2. Mapeamento</span>
          <ArrowRight size={14} className="text-app-text-muted" />
          <span className={`px-2.5 py-1 rounded-full ${step >= 3 ? 'bg-primary text-white font-bold' : 'bg-app-secondary text-app-text-muted'}`}>3. Validação</span>
          <ArrowRight size={14} className="text-app-text-muted" />
          <span className={`px-2.5 py-1 rounded-full ${step >= 4 ? 'bg-emerald-600 text-white font-bold' : 'bg-app-secondary text-app-text-muted'}`}>4. Conclusão</span>
        </div>

        {/* STEP 1: Upload File */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-app-secondary/30 border border-app-border rounded-lg p-4 flex gap-3 text-sm text-app-text-muted">
              <Info size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-app-text">Instruções para importação:</p>
                <p className="mt-1">Suba sua planilha no formato <b>CSV, XLS ou XLSX</b>. Na próxima etapa, você poderá dizer ao sistema qual coluna representa cada campo do processo.</p>
                <p className="mt-1">Para garantir a importação de novos dados sem sobresscrever nada, o sistema verificará se o número de processo já existe e ignorará os duplicados.</p>
              </div>
            </div>

            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-app-border hover:border-primary rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer bg-app-bg/20 hover:bg-primary/5 transition-all group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv, .xls, .xlsx" 
                className="hidden" 
              />
              <div className="p-4 bg-app-secondary group-hover:bg-primary/10 rounded-full text-app-text-muted group-hover:text-primary transition-colors">
                {isParsing ? (
                  <Loader2 size={32} className="animate-spin text-primary" />
                ) : (
                  <Upload size={32} />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-app-text">
                  {isParsing ? 'Processando arquivo...' : 'Arraste seu arquivo de processos aqui'}
                </p>
                <p className="text-xs text-app-text-muted mt-1">
                  ou clique para selecionar do computador (.csv, .xls, .xlsx)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Map Columns */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-primary" size={18} />
                <span className="text-sm font-bold text-app-text">{file?.name}</span>
                <span className="text-xs text-app-text-muted">({rawData.length} linhas detectadas)</span>
              </div>
              <button 
                type="button" 
                onClick={resetImport}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
              >
                <Trash2 size={14} />
                Escolher outro arquivo
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Mapeamento de Colunas</p>
                <p className="text-xs mt-1">Nós analisamos os cabeçalhos da sua planilha e tentamos adivinhar as colunas. Revise as associações abaixo. O único campo obrigatório é o <b>Número do Processo</b>.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MAPPING_FIELDS.map(field => {
                const currentMapped = mapping[field.key] || '';
                return (
                  <div key={field.key} className="p-3 bg-app-bg/50 border border-app-border rounded-lg space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-app-text flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {currentMapped && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <Check size={10} /> Auto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-app-text-muted leading-relaxed">{field.description}</p>
                    </div>
                    
                    <select
                      className="w-full text-xs px-2.5 py-1.5 border border-app-border bg-app-surface text-app-text rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      value={currentMapped}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">-- Não importar este campo --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Preview of first row mapping */}
            <div className="border border-app-border rounded-lg overflow-hidden bg-app-bg/10">
              <div className="p-2.5 bg-app-secondary border-b border-app-border text-xs font-bold text-app-text">
                Pré-visualização do Mapeamento (Linha 1 de dados reais)
              </div>
              <div className="p-3 overflow-x-auto max-h-48 scrollbar-thin custom-scrollbar text-xs">
                {rawData.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-app-border">
                        <th className="py-1.5 font-bold text-app-text-muted">Campo do Sistema</th>
                        <th className="py-1.5 font-bold text-app-text-muted">Coluna da Planilha</th>
                        <th className="py-1.5 font-bold text-app-text">Valor Extraído</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/40">
                      {MAPPING_FIELDS.map(field => {
                        const colName = mapping[field.key];
                        return (
                          <tr key={field.key}>
                            <td className="py-1 px-1 text-app-text font-medium">{field.label}</td>
                            <td className="py-1 px-1 text-app-text-muted italic">{colName || '(Não mapeado)'}</td>
                            <td className="py-1 px-1 text-app-text font-mono truncate max-w-xs">
                              {colName ? String(rawData[0][colName] || '') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-app-text-muted text-center py-2">Sem dados para pré-visualizar.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={analyzeMapping}
                disabled={!mapping.numero}
                className="bg-primary hover:opacity-90 text-white text-xs font-bold px-6 py-2 rounded-lg flex items-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
              >
                Analisar Dados e Cruzar Duplicados
                <ArrowRight size={16} className="ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Validate / Report */}
        {step === 3 && importReport && (
          <div className="space-y-6">
            <div className="bg-app-bg p-4 rounded-xl border border-app-border">
              <h3 className="text-sm font-bold text-app-text mb-3">Relatório de Análise Prévia</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-app-surface border border-app-border rounded-lg">
                  <p className="text-xs text-app-text-muted font-medium">Lidas no Arquivo</p>
                  <p className="text-xl font-bold text-app-text mt-1">{importReport.total}</p>
                </div>
                
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-500 font-medium flex items-center justify-center gap-0.5">
                    Duplicados no Sistema
                  </p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {importReport.ignoredDuplicatesInSystem.length}
                  </p>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-500 font-medium flex items-center justify-center gap-0.5">
                    Duplicados no Arquivo
                  </p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {importReport.ignoredDuplicatesInFile.length}
                  </p>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-500 font-medium">Válidos para Importar</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {importReport.toImport.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Ignored duplicates details */}
            {(importReport.ignoredDuplicatesInSystem.length > 0 || importReport.ignoredDuplicatesInFile.length > 0) && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertCircle size={16} />
                  <span>Atenção: Números de Processo Ignorados (Não serão importados)</span>
                </div>
                <p className="text-[11px] text-app-text-muted">
                  Conforme configurado, os processos cujos números coincidem com processos já existentes no sistema ou duplicados no próprio arquivo serão ignorados para evitar duplicidade.
                </p>

                <div className="max-h-36 overflow-y-auto border border-app-border/40 rounded bg-app-surface p-2 text-[10px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 custom-scrollbar">
                  {importReport.ignoredDuplicatesInSystem.map((num, i) => (
                    <div key={`sys-${i}`} className="text-red-500 flex items-center justify-between py-0.5 border-b border-app-border/20">
                      <span className="truncate">{num}</span>
                      <span className="text-[9px] font-sans font-bold bg-red-500/10 px-1 py-0.2 rounded shrink-0">No Sistema</span>
                    </div>
                  ))}
                  {importReport.ignoredDuplicatesInFile.map((num, i) => (
                    <div key={`file-${i}`} className="text-amber-600 flex items-center justify-between py-0.5 border-b border-app-border/20">
                      <span className="truncate">{num}</span>
                      <span className="text-[9px] font-sans font-bold bg-amber-500/10 px-1 py-0.2 rounded shrink-0">No Arquivo</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importReport.newContactsCount > 0 && (
              <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-3 text-xs text-blue-700 dark:text-blue-400">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Criação Automática de Contatos</p>
                  <p className="mt-0.5">Nós identificamos <b>{importReport.newContactsCount} clientes inéditos</b> na coluna mapeada. O importador criará automaticamente o cadastro de cada um deles como novos contatos do tipo "Cliente" para vincular corretamente aos novos processos.</p>
                </div>
              </div>
            )}

            {importReport.toImport.length === 0 ? (
              <div className="p-8 text-center text-app-text-muted text-xs flex flex-col items-center gap-2">
                <AlertTriangle size={28} className="text-red-500" />
                <p className="font-bold text-app-text">Nenhum processo válido para importar</p>
                <p>Todos as linhas analisadas estão duplicadas no sistema ou são inválidas (sem número de processo).</p>
                <button
                  type="button"
                  onClick={resetImport}
                  className="mt-2 bg-app-secondary text-app-text px-4 py-1.5 rounded-lg border border-app-border font-bold hover:bg-app-secondary/80"
                >
                  Reiniciar com outro arquivo
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-app-text-muted hover:text-app-text font-bold"
                >
                  Voltar para o Mapeamento
                </button>
                <button
                  type="button"
                  onClick={runImport}
                  disabled={isImporting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg flex items-center transition-all shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-40"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} className="mr-2" />
                      Confirmar e Importar {importReport.toImport.length} Processos
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Conclusion */}
        {step === 4 && importReport && (
          <div className="space-y-6 text-center py-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center text-emerald-600 mb-2">
              <CheckCircle2 size={36} />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-app-text">Importação Concluída com Sucesso!</h3>
              <p className="text-xs text-app-text-muted mt-1 max-w-md">
                Seus processos foram processados e sincronizados com a planilha do Google e os cadastros associados foram criados de forma segura.
              </p>
            </div>

            <div className="bg-app-bg p-4 rounded-xl border border-app-border text-xs text-left w-full max-w-md divide-y divide-app-border/40">
              <div className="py-2 flex justify-between">
                <span className="text-app-text-muted">Processos Importados:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{importReport.toImport.length}</span>
              </div>
              {importReport.newContactsCount > 0 && (
                <div className="py-2 flex justify-between">
                  <span className="text-app-text-muted">Novos Clientes Cadastrados:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">+{importReport.newContactsCount}</span>
                </div>
              )}
              {(importReport.ignoredDuplicatesInSystem.length > 0 || importReport.ignoredDuplicatesInFile.length > 0) && (
                <div className="py-2 flex justify-between">
                  <span className="text-app-text-muted">Ignorados (Duplicados):</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {importReport.ignoredDuplicatesInSystem.length + importReport.ignoredDuplicatesInFile.length}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={resetImport}
              className="bg-primary hover:opacity-90 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all"
            >
              Fazer outra importação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
