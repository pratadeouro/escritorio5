import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Vara, VaraStats, Forum, Tribunal } from '../types';
import { useAppContext } from '../context';
import { searchDatajud } from '../services/djenService';
import { BarChart2, TrendingUp, Info, AlertCircle, Loader2, Gavel, Scale, PieChart } from 'lucide-react';

interface VaraStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vara: Vara;
}

export default function VaraStatsModal({ isOpen, onClose, vara }: VaraStatsModalProps) {
  const { state } = useAppContext();
  const [stats, setStats] = useState<VaraStats | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen && vara) {
      fetchStats();
    }
  }, [isOpen, vara]);

  const fetchStats = async () => {
    setIsFetching(true);
    setStats(null);
    setError(null);
    setDebugInfo(null);

    try {
      const forum = state.forums.find(f => f.id === vara.forum);
      const tribunal = forum ? state.tribunais.find(t => t.id.toUpperCase() === forum.tribunalId.toUpperCase()) : null;
      const tribunalSlug = (tribunal?.id || 'tjam').toLowerCase();
      
      // Ensure we use the correct field for the CNJ code
      // The user specified that the CNJ code is in the 'id' field (ID_VARA)
      const codigoCNJ = vara.id;
      let hits: any[] = [];
      let finalUsedQuery: any = null;

      if (codigoCNJ) {
        // Extract only digits from the code, as Datajud usually expects numeric codes for orgaoJulgador.codigo
        const numericCodeStr = codigoCNJ.toString().replace(/\D/g, '');
        const codigo = parseInt(numericCodeStr);
        
        if (!isNaN(codigo) && numericCodeStr.length > 0) {
          const queryCode = {
            size: 500,
            query: {
              bool: {
                should: [
                  { term: { "orgaoJulgador.codigo": codigo } },
                  { match: { "orgaoJulgador.codigo": codigo } },
                  // Some tribunals might use the string version or padded version
                  { term: { "orgaoJulgador.codigo": numericCodeStr } },
                  { match: { "orgaoJulgador.codigo": numericCodeStr } }
                ]
              }
            },
            sort: [{ "dataAjuizamento": { "order": "desc" } }]
          };
          finalUsedQuery = queryCode;
          const result = await searchDatajud(queryCode, tribunalSlug);
          hits = result.hits?.hits || [];
        }
      }

      // Fallback to name OR if the user specifically asked to use name
      // We refine the name search to be more precise
      if (hits.length === 0 && vara.nome) {
        const queryName = {
          size: 500,
          query: {
            bool: {
              must: [
                { match_phrase: { "orgaoJulgador.nome": vara.nome } }
              ]
            }
          },
          sort: [{ "dataAjuizamento": { "order": "desc" } }]
        };
        finalUsedQuery = queryName;
        const result = await searchDatajud(queryName, tribunalSlug);
        hits = result.hits?.hits || [];
      }

      setDebugInfo({
        tribunal: tribunalSlug,
        query: finalUsedQuery,
        hitsFound: hits.length
      });

      if (hits.length === 0) {
        setError('Não foram encontrados processos públicos recentes para esta vara no Datajud.');
        return;
      }

      const processosVara = hits.map((h: any) => h._source);
      const termosJulgados = ['definitivo', 'baixa definitiva', 'baixa', 'improcedência', 'procedência', 'extinção', 'desistência', 'sentença'];
      
      let julgadosCount = 0;
      let totalDias = 0;
      const assuntosMap: Record<string, number> = {};
      const classesMap: Record<string, number> = {};
      
      processosVara.forEach((p: any) => {
        const movimentos = p.movimentos || [];
        const situacao = movimentos[0]?.nome?.toLowerCase() || '';
        const isJulgado = termosJulgados.some(term => situacao.includes(term));
        
        if (isJulgado) {
          julgadosCount++;
          if (p.dataAjuizamento && movimentos[0]?.dataHora) {
            const inicio = new Date(p.dataAjuizamento);
            const fim = new Date(movimentos[0].dataHora);
            const diff = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) totalDias += diff;
          }
        }
        
        p.assuntos?.forEach((a: any) => {
          if (a.nome) assuntosMap[a.nome] = (assuntosMap[a.nome] || 0) + 1;
        });
        
        if (p.classe?.nome) {
          classesMap[p.classe.nome] = (classesMap[p.classe.nome] || 0) + 1;
        }
      });
      
      setStats({
        totalProcessos: hits.length,
        julgados: julgadosCount,
        pendentes: hits.length - julgadosCount,
        mediaDiasJulgamento: julgadosCount > 0 ? Math.floor(totalDias / julgadosCount) : 0,
        assuntosMaisComuns: Object.entries(assuntosMap)
          .map(([nome, count]) => ({ nome, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        classesMaisComuns: Object.entries(classesMap)
          .map(([nome, count]) => ({ nome, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      });
    } catch (e: any) {
      console.error('Erro ao buscar estatísticas:', e);
      setError('Ocorreu um erro ao consultar o Datajud. Por favor, tente novamente mais tarde.');
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Estatísticas: ${vara.nome}`} maxWidth="max-w-4xl">
      <div className="space-y-6">
        {isFetching ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <div className="text-app-text-muted animate-pulse font-medium">Consultando Datajud e processando indicadores...</div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-4">
            <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
            <div className="space-y-4">
              <div>
                <h4 className="text-red-800 dark:text-red-400 font-bold uppercase transition-colors">Atenção</h4>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
              </div>
              
              {debugInfo && (
                <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                  <div className="text-[10px] uppercase font-bold text-red-800 dark:text-red-400 mb-2">Informação de Depuração (Datajud)</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-semibold block">Tribunal:</span>
                      <span className="font-mono text-[10px] break-all">{debugInfo.tribunal}</span>
                    </div>
                    <div>
                      <span className="font-semibold block">Consulta:</span>
                      <span className="font-mono text-[10px] break-all">
                        {debugInfo.query?.query?.bool?.should 
                          ? `COD: ${debugInfo.query.query.bool.should[0].term?.["orgaoJulgador.codigo"] || debugInfo.query.query.bool.should[0].match?.["orgaoJulgador.codigo"]}` 
                          : debugInfo.query?.query?.match_phrase?.["orgaoJulgador.nome"] || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <button 
                onClick={fetchStats}
                className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-app-secondary p-4 rounded-xl border border-app-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Scale size={18} />
                  </div>
                  <span className="text-xs font-bold text-app-text-muted uppercase">Total Consultados</span>
                </div>
                <div className="text-2xl font-bold text-app-text">{stats.totalProcessos}</div>
                <div className="text-[10px] text-app-text-muted mt-1 uppercase">Amostra Datajud (Últimos 500)</div>
              </div>
              
              <div className="bg-app-secondary p-4 rounded-xl border border-app-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <Gavel size={18} />
                  </div>
                  <span className="text-xs font-bold text-app-text-muted uppercase">Julgados / Baixados</span>
                </div>
                <div className="text-2xl font-bold text-emerald-500">{stats.julgados}</div>
                <div className="text-[10px] text-emerald-500 font-medium mt-1 uppercase">
                  {Math.round((stats.julgados / stats.totalProcessos) * 100)}% da Amostra
                </div>
              </div>

              <div className="bg-app-secondary p-4 rounded-xl border border-app-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <TrendingUp size={18} />
                  </div>
                  <span className="text-xs font-bold text-app-text-muted uppercase">Tempo Médio</span>
                </div>
                <div className="text-2xl font-bold text-app-text">{stats.mediaDiasJulgamento} dias</div>
                <div className="text-[10px] text-app-text-muted mt-1 uppercase">Até a Baixa / Sentença</div>
              </div>

              <div className="bg-app-secondary p-4 rounded-xl border border-app-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <BarChart2 size={18} />
                  </div>
                  <span className="text-xs font-bold text-app-text-muted uppercase">Pendentes</span>
                </div>
                <div className="text-2xl font-bold text-app-text">{stats.pendentes}</div>
                <div className="text-[10px] text-app-text-muted mt-1 uppercase">Processos em Trâmite</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assuntos */}
              <div className="bg-app-secondary rounded-xl border border-app-border overflow-hidden">
                <div className="p-4 border-b border-app-border bg-app-bg/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart size={18} className="text-primary" />
                    <h4 className="text-xs font-bold uppercase text-app-text">Assuntos Mais Comuns</h4>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {stats.assuntosMaisComuns.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-app-text font-medium truncate pr-4">{item.nome}</span>
                        <span className="text-app-text-muted font-bold whitespace-nowrap">{item.count}</span>
                      </div>
                      <div className="w-full bg-app-bg h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-1000" 
                          style={{ width: `${(item.count / stats.totalProcessos) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Classes */}
              <div className="bg-app-secondary rounded-xl border border-app-border overflow-hidden">
                <div className="p-4 border-b border-app-border bg-app-bg/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={18} className="text-primary" />
                    <h4 className="text-xs font-bold uppercase text-app-text">Classes de Processo</h4>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {stats.classesMaisComuns.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-app-text font-medium truncate pr-4">{item.nome}</span>
                        <span className="text-app-text-muted font-bold whitespace-nowrap">{item.count}</span>
                      </div>
                      <div className="w-full bg-app-bg h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-1000" 
                          style={{ width: `${(item.count / stats.totalProcessos) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-app-bg/50 rounded-xl border border-app-border/50 flex items-start gap-3">
              <Info className="text-primary shrink-0" size={18} />
              <p className="text-[11px] text-app-text-muted leading-relaxed">
                Estes dados são extraídos em tempo real do <span className="font-bold text-primary">Datajud (CNJ)</span> e baseados em uma amostra de até 500 processos mais recentes.
                O tempo médio de julgamento é calculado a partir da data de distribuição até a data da última movimentação conclusiva identificada.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-app-text-muted italic">Iniciando análise...</div>
        )}
      </div>
    </Modal>
  );
}
