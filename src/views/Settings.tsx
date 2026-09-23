import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
  Settings as SettingsIcon, 
  Database, 
  Globe, 
  ListOrdered, 
  Save, 
  RefreshCw, 
  Palette, 
  Sun, 
  Moon, 
  Building2, 
  ShieldCheck, 
  Check, 
  X as CloseIcon, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Mail, 
  Eye, 
  EyeOff, 
  Send, 
  Loader2,
  Code,
  LayoutDashboard, 
  Scale, 
  Users, 
  Calendar, 
  DollarSign, 
  FileText, 
  ClipboardList, 
  Network, 
  ListTodo, 
  Server, 
  FormInput, 
  Gavel, 
  Activity, 
  FolderOpen, 
  Landmark, 
  Sparkles, 
  Tag, 
  Settings as SettingsIconLucide,
  Bell,
  ArrowUp,
  ArrowDown,
  GripVertical,
  TrendingUp,
  History,
  Upload,
  ArrowUpCircle
} from 'lucide-react';
import { CURRENT_APP_VERSION, checkAppVersion, reloadAppForUpdate } from '../services/versionService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../components/Modal';
import ImportTab from '../components/ImportTab';
import { View, RolePermission, AppSettings } from '../types';
import { checkSheetHeaders, fixSheetHeaders, sendTestEmail, sendTestEmailExternal } from '../services/googleAppsScript';
import { 
  getWeeklyReportTemplate, 
  getNewNotificationsTemplate, 
  getDailyReportTemplate,
  DEFAULT_WEEKLY_REPORT_TEMPLATE, 
  DEFAULT_NEW_NOTIFICATIONS_TEMPLATE,
  DEFAULT_DAILY_REPORT_TEMPLATE
} from '../utils/emailTemplates';

interface SortableMenuItemProps {
  id: string;
  menu: { id: View; label: string; icon: React.ReactNode };
  index: number;
  total: number;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableMenuItem({ id, menu, index, total, onMove }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center justify-between p-3 bg-app-surface hover:bg-app-secondary/50 transition-colors group ${isDragging ? 'shadow-lg border-primary/20 ring-1 ring-primary/20 rounded-xl' : ''}`}
    >
      <div className="flex items-center flex-1">
        <div 
          {...attributes} 
          {...listeners}
          className="p-1.5 mr-2 text-app-text-muted hover:text-primary cursor-grab active:cursor-grabbing rounded transition-colors"
        >
          <GripVertical size={18} />
        </div>
        <div className="p-2 bg-app-bg rounded-lg mr-3 text-app-text-muted group-hover:text-primary transition-colors">
          {menu.icon}
        </div>
        <span className="text-sm font-medium text-app-text">{menu.label}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, 'up')}
          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-20"
          title="Mover para cima"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 'down')}
          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-20"
          title="Mover para baixo"
        >
          <ArrowDown size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { state, updateSettings, escritorioAtivoId, updateEscritorio, applyTheme, currentUser, isAdmin } = useAppContext();
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [formData, setFormData] = useState({
    ...state.settings,
    theme: activeOffice?.theme || 'light',
    primaryColor: activeOffice?.primaryColor || '#4f46e5',
    backgroundColor: activeOffice?.backgroundColor || '#ffffff',
    secondaryColor: activeOffice?.secondaryColor || '#f8fafc',
    officeName: activeOffice?.nome || '',
    officeAddress: activeOffice?.endereco || '',
    officeCNPJ: activeOffice?.cnpj || '',
    officePhone: activeOffice?.telefone || '',
    officeEmail: activeOffice?.email || '',
    logoUrl: activeOffice?.logoUrl || '',
    responsibleLawyer: activeOffice?.responsavel || '',
    oabNumber: activeOffice?.oab || '',
    uf: activeOffice?.uf || '',
    emailUser: state.settings.emailUser || '',
    emailPass: state.settings.emailPass || '',
    useExternalSmtp: state.settings.useExternalSmtp || false,
    smtpHost: state.settings.smtpHost || '',
    smtpPort: state.settings.smtpPort || 465,
    smtpSecure: state.settings.smtpSecure ?? true,
    enableEmailNotifications: state.settings.enableEmailNotifications || false,
    emailWeeklyReport: state.settings.emailWeeklyReport || false,
    emailDailyReport: state.settings.emailDailyReport || false,
    emailNewNotifications: state.settings.emailNewNotifications || false,
    templateWeeklyReport: state.settings.templateWeeklyReport || '',
    templateDailyReport: state.settings.templateDailyReport || '',
    templateNewNotifications: state.settings.templateNewNotifications || '',
    emailDispatchTime: state.settings.emailDispatchTime || '08:00',
    showMovimentos: state.settings.showMovimentos ?? true,
    diasMorosidade: state.settings.diasMorosidade || 30,
    menuOrder: state.settings.menuOrder || [],
    googleClientId: activeOffice?.googleClientId || state.settings.googleClientId || '',
    appVersion: activeOffice?.appVersion || state.settings.appVersion || '',
  });

  // Sync formData with activeOffice if it loads after mount
  React.useEffect(() => {
    if (activeOffice) {
      setFormData(prev => ({
        ...prev,
        theme: prev.theme || activeOffice.theme || 'light',
        primaryColor: prev.primaryColor || activeOffice.primaryColor || '#4f46e5',
        backgroundColor: prev.backgroundColor || activeOffice.backgroundColor || '#ffffff',
        secondaryColor: prev.secondaryColor || activeOffice.secondaryColor || '#f8fafc',
        officeName: prev.officeName || activeOffice.nome || '',
        officeAddress: prev.officeAddress || activeOffice.endereco || '',
        responsibleLawyer: prev.responsibleLawyer || activeOffice.responsavel || '',
        oabNumber: prev.oabNumber || activeOffice.oab || '',
        uf: prev.uf || activeOffice.uf || '',
        enableEmailNotifications: activeOffice.enableEmailNotifications ?? prev.enableEmailNotifications ?? false,
        emailWeeklyReport: activeOffice.emailWeeklyReport ?? prev.emailWeeklyReport ?? false,
        emailDailyReport: activeOffice.emailDailyReport ?? prev.emailDailyReport ?? false,
        emailNewNotifications: activeOffice.emailNewNotifications ?? prev.emailNewNotifications ?? false,
        templateWeeklyReport: activeOffice.templateWeeklyReport || prev.templateWeeklyReport || '',
        templateDailyReport: activeOffice.templateDailyReport || prev.templateDailyReport || '',
        templateNewNotifications: activeOffice.templateNewNotifications || prev.templateNewNotifications || '',
        emailDispatchTime: activeOffice.emailDispatchTime || prev.emailDispatchTime || '08:00',
        googleClientId: activeOffice.googleClientId || prev.googleClientId || '',
        appVersion: activeOffice.appVersion || prev.appVersion || state.settings.appVersion || '',
      }));
    }
  }, [activeOffice]);

  // Handle immediate theme preview
  const handleThemePreview = (updates: Partial<typeof formData>) => {
    const newFormData = { ...formData, ...updates };
    setFormData(newFormData);
    
    // Apply immediate preview to DOM
    if (applyTheme) {
      applyTheme(
        newFormData.theme as 'light' | 'dark',
        newFormData.primaryColor,
        newFormData.backgroundColor,
        newFormData.secondaryColor
      );
    }
  };

  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'theme' | 'office' | 'email' | 'regional' | 'import'>('theme');

  const [isCheckingHeaders, setIsCheckingHeaders] = useState(false);
  const [headerReport, setHeaderReport] = useState<{ sheet: string; status: string; missingColumns: string[] }[] | null>(null);
  const [isFixingHeaders, setIsFixingHeaders] = useState(false);

  const [showPass, setShowPass] = useState(false);
  const [testRecipient, setTestRecipient] = useState(state.settings.emailUser || currentUser?.email || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingWeeklyTest, setIsSendingWeeklyTest] = useState(false);
  const [isSendingDailyTest, setIsSendingDailyTest] = useState(false);
  const [isSendingNewNotificationsTest, setIsSendingNewNotificationsTest] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState({ title: '', html: '' });

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState({ type: 'weekly', title: '', content: '', placeholders: [] as string[] });

  const handleEditWeeklyTemplate = () => {
    setEditingTemplate({
      type: 'weekly',
      title: 'Editar Modelo: Relatório Semanal',
      content: formData.templateWeeklyReport || DEFAULT_WEEKLY_REPORT_TEMPLATE,
      placeholders: ['{{officeName}}', '{{activeProcesses}}', '{{pendingTasks}}', '{{totalCustomers}}', '{{pendingEvents}}', '{{pendingProcesses}}', '{{lateProcesses}}', '{{publicationsToday}}', '{{year}}']
    });
    setIsTemplateEditorOpen(true);
  };

  const handleEditDailyTemplate = () => {
    setEditingTemplate({
      type: 'daily',
      title: 'Editar Modelo: Relatório Diário',
      content: formData.templateDailyReport || DEFAULT_DAILY_REPORT_TEMPLATE,
      placeholders: ['{{officeName}}', '{{publicationsToday}}', '{{pendingTasks}}', '{{pendingProcesses}}', '{{pendingEvents}}', '{{lateProcesses}}', '{{diasMorosidade}}', '{{year}}']
    });
    setIsTemplateEditorOpen(true);
  };

  const handleEditNotificationsTemplate = () => {
    setEditingTemplate({
      type: 'notifications',
      title: 'Editar Modelo: Intimações Novas',
      content: formData.templateNewNotifications || DEFAULT_NEW_NOTIFICATIONS_TEMPLATE,
      placeholders: ['{{officeName}}', '{{date}}', '{{count}}', '{{responsible}}', '{{itemsHtml}}', '{{moreItemsHtml}}', '{{year}}']
    });
    setIsTemplateEditorOpen(true);
  };

  const saveTemplate = () => {
    if (editingTemplate.type === 'weekly') {
      setFormData({ ...formData, templateWeeklyReport: editingTemplate.content });
    } else if (editingTemplate.type === 'daily') {
      setFormData({ ...formData, templateDailyReport: editingTemplate.content });
    } else {
      setFormData({ ...formData, templateNewNotifications: editingTemplate.content });
    }
    setIsTemplateEditorOpen(false);
  };

  const handlePreviewWeeklyReport = () => {
    const activeProcessos = state.processos.filter(p => {
      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return p.status === 'Ativo';
    });

    const totalProcessos = activeProcessos.length;
    
    const totalClientes = state.contatos.filter(c => {
      const pEscId = (c.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return c.tipo === 'Cliente';
    }).length;

    const tarefasPendentes = state.tarefas.filter(t => {
      const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      if (activeEscId && pEscId !== activeEscId) return false;
      if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return t.STATUS?.toLowerCase() !== 'concluída' && t.STATUS?.toLowerCase() !== 'concluida';
    }).length;

    const eventosPendentes = state.eventos.filter(e => {
      const isGlobal = e.escritorioId?.toLowerCase() === 'x';
      if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
      if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
      return !e.concluido;
    }).length;

    const processosPendentes = state.processos.filter(p => {
      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      const statusRaw = (p.ativo || '').toLowerCase();
      const tagsRaw = (p.tags || '').toLowerCase();
      return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
    }).length;

    const diasMorosidade = state.settings.diasMorosidade || 30;
    const hoje = new Date();
    const processosMorosos = activeProcessos.filter(p => {
      const movimentosProc = state.movimentos.filter(m => 
        String(m.processoId) === String(p.id) || 
        String(m.processoId) === String(p.idProc) || 
        String(m.processoId) === String(p.numero)
      );
      if (movimentosProc.length === 0) {
        if (!p.dataDistribuicao) return false;
        const dataDist = new Date(p.dataDistribuicao);
        const diffTime = Math.abs(hoje.getTime() - dataDist.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > diasMorosidade;
      }
      const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
      const dataMov = new Date(ultimaMov.data);
      const diffTime = Math.abs(hoje.getTime() - dataMov.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > diasMorosidade;
    }).length;

    const html = getWeeklyReportTemplate({
      officeName: activeOffice?.nome || 'Seu Escritório',
      activeProcesses: totalProcessos,
      pendingTasks: tarefasPendentes,
      totalCustomers: totalClientes,
      pendingEvents: eventosPendentes,
      pendingProcesses: processosPendentes,
      lateProcesses: processosMorosos,
      publicationsToday: 0, // In preview we don't fetch real data
      year: new Date().getFullYear()
    }, formData.templateWeeklyReport);

    setPreviewContent({ title: 'Visualização: Relatório Semanal', html });
    setIsPreviewModalOpen(true);
  };

  const handlePreviewDailyReport = () => {
    const activeProcessos = state.processos.filter(p => {
      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return p.status === 'Ativo';
    });

    const tarefasPendentes = state.tarefas.filter(t => {
      const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      if (activeEscId && pEscId !== activeEscId) return false;
      if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return t.STATUS?.toLowerCase() !== 'concluída' && t.STATUS?.toLowerCase() !== 'concluida';
    }).length;

    const eventosPendentes = state.eventos.filter(e => {
      const isGlobal = e.escritorioId?.toLowerCase() === 'x';
      if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
      if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
      return !e.concluido;
    }).length;

    const processosPendentes = state.processos.filter(p => {
      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      const statusRaw = (p.ativo || '').toLowerCase();
      const tagsRaw = (p.tags || '').toLowerCase();
      return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
    }).length;

    const diasMorosidade = state.settings.diasMorosidade || 30;
    const hoje = new Date();
    const processosMorosos = activeProcessos.filter(p => {
      const movimentosProc = state.movimentos.filter(m => 
        String(m.processoId) === String(p.id) || 
        String(m.processoId) === String(p.idProc) || 
        String(m.processoId) === String(p.numero)
      );
      if (movimentosProc.length === 0) {
        if (!p.dataDistribuicao) return false;
        const dataDist = new Date(p.dataDistribuicao);
        const diffTime = Math.abs(hoje.getTime() - dataDist.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > diasMorosidade;
      }
      const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
      const dataMov = new Date(ultimaMov.data);
      const diffTime = Math.abs(hoje.getTime() - dataMov.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > diasMorosidade;
    }).length;

    const html = getDailyReportTemplate({
      officeName: activeOffice?.nome || 'Seu Escritório',
      publicationsToday: 0,
      pendingTasks: tarefasPendentes,
      pendingProcesses: processosPendentes,
      pendingEvents: eventosPendentes,
      lateProcesses: processosMorosos,
      diasMorosidade: diasMorosidade,
      year: new Date().getFullYear()
    }, formData.templateDailyReport);

    setPreviewContent({ title: 'Visualização: Relatório Diário', html });
    setIsPreviewModalOpen(true);
  };

  const handlePreviewNewNotifications = () => {
    const responsavel = activeOffice?.responsavel || currentUser?.nome || 'Advogado Responsável';
    
    // Mock items for preview
    const mockItems = [
      { numeroProcesso: '0812345-67.2024.8.04.0001', texto: 'Fica intimada a parte autora para se manifestar sobre a contestação apresentada no prazo de 15 dias...', orgao: '10ª Vara Cível' },
      { numeroProcesso: '0898765-43.2023.8.04.0001', texto: 'Sentença proferida: JULGO PROCEDENTE o pedido formulado na inicial para condenar a requerida ao pagamento...', orgao: '3ª Vara de Família' }
    ];

    const html = getNewNotificationsTemplate({
      officeName: activeOffice?.nome || 'Seu Escritório',
      date: new Date().toLocaleDateString('pt-BR'),
      count: 2,
      responsible: responsavel,
      items: mockItems,
      year: new Date().getFullYear()
    }, formData.templateNewNotifications);

    setPreviewContent({ title: 'Visualização: Intimações Novas', html });
    setIsPreviewModalOpen(true);
  };

  const handleTestEmail = async () => {
    if (!formData.emailUser || (!formData.useExternalSmtp && !state.settings.scriptUrl)) {
      setTestStatus({ success: false, message: 'Configure o e-mail e salve antes de testar.' });
      return;
    }
    
    if (formData.useExternalSmtp && (!formData.smtpHost || !formData.smtpPort)) {
      setTestStatus({ success: false, message: 'Configure o servidor SMTP e a porta antes de testar.' });
      return;
    }

    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const destination = testRecipient || currentUser?.email || formData.emailUser;
      let success = false;
      if (formData.useExternalSmtp) {
        success = await sendTestEmailExternal({
          host: formData.smtpHost!,
          port: formData.smtpPort!,
          secure: formData.smtpSecure!,
          user: formData.emailUser,
          pass: formData.emailPass,
          to: destination
        });
      } else {
        success = await sendTestEmail(
          state.settings.scriptUrl,
          destination,
          formData.emailUser,
          formData.emailPass
        );
      }
      
      if (success) {
        setTestStatus({ success: true, message: 'E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.' });
      }
    } catch (error: any) {
      setTestStatus({ success: false, message: error.message || 'Falha ao enviar e-mail de teste.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTestWeeklyReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formData.emailUser || (!formData.useExternalSmtp && !state.settings.scriptUrl)) {
      setTestStatus({ success: false, message: 'Configure o e-mail e salve antes de testar.' });
      return;
    }
    setIsSendingWeeklyTest(true);
    setTestStatus(null);
    try {
      const destination = testRecipient || currentUser?.email || formData.emailUser;
      
      const activeProcessos = state.processos.filter(p => {
        const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        const isGlobal = pEscId === 'X';
        if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
        if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        return p.status === 'Ativo';
      });

      const totalProcessos = activeProcessos.length;
      
      const totalClientes = state.contatos.filter(c => {
        const pEscId = (c.escritorioId || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        const isGlobal = pEscId === 'X';
        if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
        if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        return c.tipo === 'Cliente';
      }).length;

      const tarefasPendentes = state.tarefas.filter(t => {
        const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        if (activeEscId && pEscId !== activeEscId) return false;
        if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        return t.STATUS?.toLowerCase() !== 'concluída' && t.STATUS?.toLowerCase() !== 'concluida';
      }).length;

      const eventosPendentes = state.eventos.filter(e => {
        const isGlobal = e.escritorioId?.toLowerCase() === 'x';
        if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
        if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
        return !e.concluido;
      }).length;

      const processosPendentes = state.processos.filter(p => {
        const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        const isGlobal = pEscId === 'X';
        if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
        if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        const statusRaw = (p.ativo || '').toLowerCase();
        const tagsRaw = (p.tags || '').toLowerCase();
        return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
      }).length;

      const diasMorosidade = state.settings.diasMorosidade || 30;
      const hoje = new Date();
      const processosMorosos = activeProcessos.filter(p => {
        const movimentosProc = state.movimentos.filter(m => 
          String(m.processoId) === String(p.id) || 
          String(m.processoId) === String(p.idProc) || 
          String(m.processoId) === String(p.numero)
        );
        if (movimentosProc.length === 0) {
          if (!p.dataDistribuicao) return false;
          const dataDist = new Date(p.dataDistribuicao);
          const diffTime = Math.abs(hoje.getTime() - dataDist.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > diasMorosidade;
        }
        const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
        const dataMov = new Date(ultimaMov.data);
        const diffTime = Math.abs(hoje.getTime() - dataMov.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > diasMorosidade;
      }).length;

      const reportBody = getWeeklyReportTemplate({
        officeName: activeOffice?.nome || 'Seu Escritório',
        activeProcesses: totalProcessos,
        pendingTasks: tarefasPendentes,
        totalCustomers: totalClientes,
        pendingEvents: eventosPendentes,
        pendingProcesses: processosPendentes,
        lateProcesses: processosMorosos,
        publicationsToday: 0,
        year: new Date().getFullYear()
      }, formData.templateWeeklyReport);

      const success = formData.useExternalSmtp 
        ? await sendTestEmailExternal({
            host: formData.smtpHost!,
            port: formData.smtpPort!,
            secure: formData.smtpSecure!,
            user: formData.emailUser,
            pass: formData.emailPass,
            to: destination,
            subject: `Relatório Semanal - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            html: reportBody
          })
        : await sendTestEmail(
            state.settings.scriptUrl, 
            destination, 
            formData.emailUser, 
            formData.emailPass, 
            `Relatório Semanal - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            reportBody
          );
      
      if (success) {
        setTestStatus({ success: true, message: 'E-mail de Relatório Semanal enviado com sucesso!' });
      }
    } catch (error: any) {
      setTestStatus({ success: false, message: error.message || 'Falha ao enviar e-mail de teste.' });
    } finally {
      setIsSendingWeeklyTest(false);
    }
  };

  const handleTestDailyReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formData.emailUser || (!formData.useExternalSmtp && !state.settings.scriptUrl)) {
      setTestStatus({ success: false, message: 'Configure o e-mail e salve antes de testar.' });
      return;
    }
    setIsSendingDailyTest(true);
    setTestStatus(null);
    try {
      const destination = testRecipient || currentUser?.email || formData.emailUser;
      
      const activeProcessos = state.processos.filter(p => {
        const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        const isGlobal = pEscId === 'X';
        if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
        if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        return p.status === 'Ativo';
      });

      const tarefasPendentes = state.tarefas.filter(t => {
        const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        if (activeEscId && pEscId !== activeEscId) return false;
        if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        return t.STATUS?.toLowerCase() !== 'concluída' && t.STATUS?.toLowerCase() !== 'concluida';
      }).length;

      const eventosPendentes = state.eventos.filter(e => {
        const isGlobal = e.escritorioId?.toLowerCase() === 'x';
        if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
        if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
        return !e.concluido;
      }).length;

      const processosPendentes = state.processos.filter(p => {
        const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
        const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
        const isGlobal = pEscId === 'X';
        if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
        if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
        const statusRaw = (p.ativo || '').toLowerCase();
        const tagsRaw = (p.tags || '').toLowerCase();
        return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
      }).length;

      const diasMorosidade = state.settings.diasMorosidade || 30;
      const hoje = new Date();
      const processosMorosos = activeProcessos.filter(p => {
        const movimentosProc = state.movimentos.filter(m => 
          String(m.processoId) === String(p.id) || 
          String(m.processoId) === String(p.idProc) || 
          String(m.processoId) === String(p.numero)
        );
        if (movimentosProc.length === 0) {
          if (!p.dataDistribuicao) return false;
          const dataDist = new Date(p.dataDistribuicao);
          const diffTime = Math.abs(hoje.getTime() - dataDist.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > diasMorosidade;
        }
        const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
        const dataMov = new Date(ultimaMov.data);
        const diffTime = Math.abs(hoje.getTime() - dataMov.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > diasMorosidade;
      }).length;

      const reportBody = getDailyReportTemplate({
        officeName: activeOffice?.nome || 'Seu Escritório',
        publicationsToday: 0,
        pendingTasks: tarefasPendentes,
        pendingProcesses: processosPendentes,
        pendingEvents: eventosPendentes,
        lateProcesses: processosMorosos,
        diasMorosidade: diasMorosidade,
        year: new Date().getFullYear()
      }, formData.templateDailyReport);

      const success = formData.useExternalSmtp 
        ? await sendTestEmailExternal({
            host: formData.smtpHost!,
            port: formData.smtpPort!,
            secure: formData.smtpSecure!,
            user: formData.emailUser,
            pass: formData.emailPass,
            to: destination,
            subject: `Relatório Diário - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            html: reportBody
          })
        : await sendTestEmail(
            state.settings.scriptUrl, 
            destination, 
            formData.emailUser, 
            formData.emailPass, 
            `Relatório Diário - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            reportBody
          );
      
      if (success) {
        setTestStatus({ success: true, message: 'E-mail de Relatório Diário enviado com sucesso!' });
      }
    } catch (error: any) {
      setTestStatus({ success: false, message: error.message || 'Falha ao enviar e-mail de teste.' });
    } finally {
      setIsSendingDailyTest(false);
    }
  };

  const handleTestNewNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formData.emailUser || (!formData.useExternalSmtp && !state.settings.scriptUrl)) {
      setTestStatus({ success: false, message: 'Configure o e-mail e salve antes de testar.' });
      return;
    }
    setIsSendingNewNotificationsTest(true);
    setTestStatus(null);
    try {
      const destination = testRecipient || currentUser?.email || formData.emailUser;
      
      const responsavel = activeOffice?.responsavel || currentUser?.nome || '';
      const today = new Date().toISOString().split('T')[0];
      const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=10&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(responsavel)}`;
      
      let itemsHtml = '';
      let count = 0;
      let items: any[] = [];

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          count = data.count || 0;
          items = data.items || [];
          
          if (items.length > 0) {
            items.slice(0, 5).forEach((item: any) => {
              itemsHtml += `
                <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #4f46e5;">
                  <p style="margin: 0; font-weight: 800; color: #1e293b; font-size: 14px;">${item.numeroProcesso}</p>
                  <p style="margin: 8px 0; font-size: 13px; color: #475569; line-height: 1.5;">${item.texto?.substring(0, 200)}...</p>
                  <div style="display: flex; gap: 10px; font-size: 11px; color: #94a3b8;">
                    <span>📍 ${item.orgaoMnemonic || 'Órgão não informado'}</span>
                  </div>
                </div>
              `;
            });
          }
        }
      } catch (err) {
        console.error('Error fetching real notifications for test:', err);
      }

      const notificationBody = getNewNotificationsTemplate({
        officeName: activeOffice?.nome || 'Seu Escritório',
        date: new Date().toLocaleDateString('pt-BR'),
        count: count,
        responsible: responsavel,
        items: items.slice(0, 5).map((item: any) => ({
          numeroProcesso: item.numeroProcesso,
          texto: item.texto || '',
          orgao: item.orgaoMnemonic
        })),
        year: new Date().getFullYear()
      }, formData.templateNewNotifications);

      const success = formData.useExternalSmtp 
        ? await sendTestEmailExternal({
            host: formData.smtpHost!,
            port: formData.smtpPort!,
            secure: formData.smtpSecure!,
            user: formData.emailUser,
            pass: formData.emailPass,
            to: destination,
            subject: `Novas Intimações - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            html: notificationBody
          })
        : await sendTestEmail(
            state.settings.scriptUrl, 
            destination, 
            formData.emailUser, 
            formData.emailPass, 
            `Novas Intimações - ${activeOffice?.nome || 'LEXGESTÃO'} (Teste)`,
            notificationBody
          );
      
      if (success) {
        setTestStatus({ success: true, message: 'E-mail de Novas Intimações enviado com sucesso!' });
      }
    } catch (error: any) {
      setTestStatus({ success: false, message: error.message || 'Falha ao enviar e-mail de teste.' });
    } finally {
      setIsSendingNewNotificationsTest(false);
    }
  };

  const handleCheckHeaders = async () => {
    if (!state.settings.scriptUrl) return;
    setIsCheckingHeaders(true);
    setHeaderReport(null);
    try {
      const report = await checkSheetHeaders(state.settings.scriptUrl);
      setHeaderReport(report);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingHeaders(false);
    }
  };

  const handleFixHeaders = async () => {
    if (!state.settings.scriptUrl) return;
    setIsFixingHeaders(true);
    try {
      const success = await fixSheetHeaders(state.settings.scriptUrl);
      if (success) {
        await handleCheckHeaders();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFixingHeaders(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update global settings
    updateSettings({
      ...state.settings,
      spreadsheetId: formData.spreadsheetId,
      scriptUrl: formData.scriptUrl,
      timezone: formData.timezone,
      itemsPerPage: formData.itemsPerPage,
      permissions: formData.permissions,
      emailUser: formData.emailUser,
      emailPass: formData.emailPass,
      useExternalSmtp: formData.useExternalSmtp,
      smtpHost: formData.smtpHost,
      smtpPort: formData.smtpPort,
      smtpSecure: formData.smtpSecure,
      enableEmailNotifications: formData.enableEmailNotifications,
      emailWeeklyReport: formData.emailWeeklyReport,
      emailDailyReport: formData.emailDailyReport,
      emailNewNotifications: formData.emailNewNotifications,
      templateWeeklyReport: formData.templateWeeklyReport,
      templateDailyReport: formData.templateDailyReport,
      templateNewNotifications: formData.templateNewNotifications,
      emailDispatchTime: formData.emailDispatchTime,
      showMovimentos: formData.showMovimentos,
      diasMorosidade: formData.diasMorosidade,
      menuOrder: formData.menuOrder,
      googleClientId: formData.googleClientId,
      appVersion: formData.appVersion
    });

    // Update active office settings
    if (activeOffice) {
      updateEscritorio({
        ...activeOffice,
        nome: formData.officeName,
        cnpj: formData.officeCNPJ,
        endereco: formData.officeAddress,
        telefone: formData.officePhone,
        email: formData.officeEmail,
        logoUrl: formData.logoUrl,
        responsavel: formData.responsibleLawyer,
        oab: formData.oabNumber,
        uf: formData.uf,
        theme: formData.theme as 'light' | 'dark',
        primaryColor: formData.primaryColor,
        backgroundColor: formData.backgroundColor,
        secondaryColor: formData.secondaryColor,
        timezone: formData.timezone,
        itemsPerPage: formData.itemsPerPage,
        emailUser: formData.emailUser,
        emailPass: formData.emailPass,
        useExternalSmtp: formData.useExternalSmtp,
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpSecure: formData.smtpSecure,
        enableEmailNotifications: formData.enableEmailNotifications,
        emailWeeklyReport: formData.emailWeeklyReport,
        emailDailyReport: formData.emailDailyReport,
        emailNewNotifications: formData.emailNewNotifications,
        templateWeeklyReport: formData.templateWeeklyReport,
        templateDailyReport: formData.templateDailyReport,
        templateNewNotifications: formData.templateNewNotifications,
        emailDispatchTime: formData.emailDispatchTime,
        showMovimentos: formData.showMovimentos,
        diasMorosidade: formData.diasMorosidade,
        menuOrder: formData.menuOrder,
        googleClientId: formData.googleClientId,
        appVersion: formData.appVersion
      });
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const timezones = [
    'America/Sao_Paulo',
    'America/Manaus',
    'America/Belem',
    'America/Fortaleza',
    'America/Recife',
    'America/Cuiaba',
    'America/Campo_Grande',
    'UTC'
  ];

  const tabs = [
    { id: 'theme', label: 'Tema do Escritório', icon: <Palette size={18} /> },
    { id: 'office', label: 'Dados do Escritório', icon: <Building2 size={18} /> },
    { id: 'email', label: 'E-mail e Notificações', icon: <Mail size={18} /> },
    { id: 'regional', label: 'Regional', icon: <Globe size={18} /> },
    { id: 'import', label: 'Importar Processos', icon: <Upload size={18} /> },
  ];

  const allMenuItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'ia', label: 'Módulo IA', icon: <Sparkles size={18} /> },
    { id: 'contatos', label: 'Contatos', icon: <Users size={18} /> },
    { id: 'processosAtivos', label: 'Processos Ativos', icon: <ClipboardList size={18} /> },
    { id: 'pendencias', label: 'Pendências', icon: <Server size={18} /> },
    { id: 'eventos', label: 'Eventos', icon: <Calendar size={18} /> },
    { id: 'tarefas', label: 'Tarefas / Prazos', icon: <ListTodo size={18} /> },
    { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={18} /> },
    { id: 'documentos', label: 'Gerador de Documentos', icon: <FolderOpen size={18} /> },
    { id: 'modelos', label: 'Modelos', icon: <Copy size={18} /> },
    { id: 'djen', label: 'Módulo DJEN', icon: <Bell size={18} /> },
    { id: 'calendario', label: 'Calendário Judicial', icon: <Calendar size={18} /> },
    { id: 'movimentos', label: 'Movimentos', icon: <Activity size={18} /> },
    { id: 'recursos', label: 'Recursos', icon: <FileText size={18} /> },
    { id: 'processosGeral', label: 'Processos Geral', icon: <Scale size={18} /> },
    { id: 'etiquetas', label: 'Etiquetas', icon: <Tag size={18} /> },
    { id: 'usuarios', label: 'Usuários', icon: <Users size={18} /> },
    { id: 'escritorios', label: 'Escritórios', icon: <Building2 size={18} /> },
    { id: 'varas', label: 'Varas', icon: <Building2 size={18} /> },
    { id: 'forum', label: 'Fóruns', icon: <Landmark size={18} /> },
    { id: 'tribunais', label: 'Tribunais', icon: <Landmark size={18} /> },
    { id: 'upj', label: 'UPJ', icon: <Building2 size={18} /> },
    { id: 'julgadores', label: 'Julgadores', icon: <Gavel size={18} /> },
    { id: 'servidores', label: 'Servidores', icon: <Users size={18} /> },
    { id: 'api_diario', label: 'Consulta - DJEN', icon: <FileText size={18} /> },
    { id: 'leads', label: 'Leads', icon: <TrendingUp size={18} /> },
    { id: 'settings', label: 'Configurações', icon: <SettingsIconLucide size={18} /> },
    { id: 'logs', label: 'Logs do Sistema', icon: <History size={18} /> },
  ];

  const currentMenuOrder = React.useMemo(() => {
    const order = formData.menuOrder.length > 0 
      ? [...formData.menuOrder] 
      : allMenuItems.map(m => m.id);
    
    // Garantir que novos itens adicionados ao sistema no futuro apareçam no final do menu
    allMenuItems.forEach(item => {
      if (!order.includes(item.id)) {
        order.push(item.id);
      }
    });
    
    return order;
  }, [formData.menuOrder]);

  const handleMoveMenu = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentMenuOrder];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newOrder.length) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[newIndex];
      newOrder[newIndex] = temp;
      setFormData({ ...formData, menuOrder: newOrder });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentMenuOrder.indexOf(active.id as View);
      const newIndex = currentMenuOrder.indexOf(over.id as View);

      const newOrder = arrayMove(currentMenuOrder, oldIndex, newIndex);
      setFormData({ ...formData, menuOrder: newOrder });
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <SettingsIcon className="mr-3 text-primary" />
          Configurações do Sistema
        </h1>
      </div>

      <div className="flex border-b border-app-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'theme' && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-app-border bg-app-secondary flex items-center justify-between">
              <div className="flex items-center">
                <Palette className="mr-2 text-primary" size={20} />
                <h2 className="font-semibold text-app-text">Configurações Visuais do Escritório (Global)</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaults = {
                    theme: 'light' as const,
                    primaryColor: '#4f46e5',
                    backgroundColor: '#ffffff',
                    secondaryColor: '#f8fafc'
                  };
                  handleThemePreview(defaults);
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Resetar para o Padrão
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 p-4 rounded-xl flex items-start gap-3 mb-4">
                <ShieldCheck className="text-amber-600 shrink-0" size={20} />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <b>Atenção:</b> As cores e o modo definidos aqui são o <b>padrão visual para todos os membros</b> do escritório {activeOffice?.nome}. 
                  Usuários individuais podem sobrescrever o Modo (Claro/Escuro) em "Preferências".
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-app-text">Modo Padrão do Escritório</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => handleThemePreview({ theme: 'light' })}
                      className={`flex-1 flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.theme === 'light' 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-app-border bg-app-bg text-app-text-muted'
                      }`}
                    >
                      <Sun size={24} className="mb-2" />
                      <span className="font-medium">Claro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemePreview({ theme: 'dark' })}
                      className={`flex-1 flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.theme === 'dark' 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-app-border bg-app-bg text-app-text-muted'
                      }`}
                    >
                      <Moon size={24} className="mb-2" />
                      <span className="font-medium">Escuro</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-app-text">Cor de Destaque (Primária)</label>
                  <div className="flex flex-wrap gap-3">
                    {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleThemePreview({ primaryColor: color })}
                        className={`w-10 h-10 rounded-full border-4 transition-all ${
                          formData.primaryColor === color ? 'border-app-border scale-110' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="relative">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={e => handleThemePreview({ primaryColor: e.target.value })}
                        className="w-10 h-10 rounded-full border-none p-0 cursor-pointer overflow-hidden"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-app-text-muted">Esta cor será aplicada a botões, ícones e seleções em todo o sistema.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-app-text">Cores Personalizadas (Modo Claro)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-app-text-muted uppercase">Fundo</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.backgroundColor}
                          onChange={e => handleThemePreview({ backgroundColor: e.target.value })}
                          className="w-8 h-8 rounded-full border-none p-0 cursor-pointer overflow-hidden"
                        />
                        <span className="text-xs font-mono uppercase">{formData.backgroundColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-app-text-muted uppercase">Secundária</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.secondaryColor}
                          onChange={e => handleThemePreview({ secondaryColor: e.target.value })}
                          className="w-8 h-8 rounded-full border-none p-0 cursor-pointer overflow-hidden"
                        />
                        <span className="text-xs font-mono uppercase">{formData.secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-app-text-muted italic">Nota: Estas cores são aplicadas apenas no Modo Claro. O Modo Escuro utiliza uma paleta otimizada padrão.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'office' && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-app-border bg-app-secondary flex items-center">
              <Building2 className="mr-2 text-primary" size={20} />
              <h2 className="font-semibold text-app-text">Configurações do Escritório</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Nome do Escritório</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.officeName}
                    onChange={e => setFormData({ ...formData, officeName: e.target.value })}
                    placeholder="Ex: Silva & Associados"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Advogado Responsável</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.responsibleLawyer}
                    onChange={e => setFormData({ ...formData, responsibleLawyer: e.target.value })}
                    placeholder="Ex: Dr. João Silva"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Nº da OAB</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.oabNumber}
                    onChange={e => setFormData({ ...formData, oabNumber: e.target.value })}
                    placeholder="Ex: 123.456"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">CNPJ do Escritório</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.officeCNPJ}
                    onChange={e => setFormData({ ...formData, officeCNPJ: e.target.value })}
                    placeholder="Ex: 00.000.000/0001-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Telefone</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.officePhone}
                    onChange={e => setFormData({ ...formData, officePhone: e.target.value })}
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">E-mail de Contato</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.officeEmail}
                    onChange={e => setFormData({ ...formData, officeEmail: e.target.value })}
                    placeholder="Ex: contato@escritorio.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">UF da OAB</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    placeholder="Ex: AM"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-app-text">Endereço</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.officeAddress}
                    onChange={e => setFormData({ ...formData, officeAddress: e.target.value })}
                    placeholder="Ex: Av. Paulista, 1000, São Paulo - SP"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-app-text">URL da Logo</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.logoUrl}
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="Ex: https://link-da-imagem.com/logo.png"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

{activeTab === 'email' && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-app-border bg-app-secondary flex items-center justify-between">
              <div className="flex items-center">
                <Mail className="mr-2 text-primary" size={20} />
                <h2 className="font-semibold text-app-text">Configurações de E-mail</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-app-text-muted">Usar SMTP Externo</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, useExternalSmtp: !formData.useExternalSmtp })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    formData.useExternalSmtp ? 'bg-primary' : 'bg-app-border'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      formData.useExternalSmtp ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-app-bg/50 p-4 rounded-xl border border-app-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-app-text">Ativar envio de e-mails</p>
                    <p className="text-xs text-app-text-muted">Habilite para permitir que o sistema envie notificações automáticas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, enableEmailNotifications: !formData.enableEmailNotifications })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.enableEmailNotifications ? 'bg-primary' : 'bg-app-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.enableEmailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.enableEmailNotifications && (
                  <div className="pt-4 border-t border-app-border space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-app-text">Horário de Envio</label>
                        <p className="text-xs text-app-text-muted">Horário preferencial para envio dos relatórios diário e semanal.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          className="px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          value={formData.emailDispatchTime}
                          onChange={e => setFormData({ ...formData, emailDispatchTime: e.target.value })}
                        />
                        <span className="text-xs text-app-text-muted font-medium bg-app-secondary px-2 py-1 rounded">
                          {formData.timezone}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div 
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        formData.emailWeeklyReport 
                          ? 'border-primary bg-primary/5' 
                          : 'border-app-border bg-app-surface'
                      }`}
                      onClick={() => setFormData({ ...formData, emailWeeklyReport: !formData.emailWeeklyReport })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <FileText size={18} />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${formData.emailWeeklyReport ? 'bg-primary animate-pulse' : 'bg-app-border'}`} />
                      </div>
                      <p className="text-sm font-bold text-app-text mb-1">Relatório Semanal</p>
                      <p className="text-[10px] text-app-text-muted leading-relaxed">
                        Receba um resumo dos dados do seu dashboard toda semana diretamente no seu e-mail.
                      </p>
                      {formData.emailWeeklyReport && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePreviewWeeklyReport(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-app-text-muted rounded-lg hover:bg-app-bg transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Eye size={12} />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditWeeklyTemplate(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-primary rounded-lg hover:bg-primary/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Code size={12} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={handleTestWeeklyReport}
                            disabled={isSendingWeeklyTest || !formData.emailUser}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-app-bg border border-app-border text-primary rounded-lg hover:bg-primary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            {isSendingWeeklyTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Enviar Teste
                          </button>
                        </div>
                      )}
                    </div>

                    <div 
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        formData.emailDailyReport 
                          ? 'border-primary bg-primary/5' 
                          : 'border-app-border bg-app-surface'
                      }`}
                      onClick={() => setFormData({ ...formData, emailDailyReport: !formData.emailDailyReport })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Calendar size={18} />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${formData.emailDailyReport ? 'bg-primary animate-pulse' : 'bg-app-border'}`} />
                      </div>
                      <p className="text-sm font-bold text-app-text mb-1">Relatório Diário</p>
                      <p className="text-[10px] text-app-text-muted leading-relaxed">
                        Resumo diário contendo tarefas pendentes, morosidade e novas publicações/intimações.
                      </p>
                      {formData.emailDailyReport && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePreviewDailyReport(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-app-text-muted rounded-lg hover:bg-app-bg transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Eye size={12} />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditDailyTemplate(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-primary rounded-lg hover:bg-primary/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Code size={12} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={handleTestDailyReport}
                            disabled={isSendingDailyTest || !formData.emailUser}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-app-bg border border-app-border text-primary rounded-lg hover:bg-primary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            {isSendingDailyTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Enviar Teste
                          </button>
                        </div>
                      )}
                    </div>

                    <div 
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        formData.emailNewNotifications 
                          ? 'border-primary bg-primary/5' 
                          : 'border-app-border bg-app-surface'
                      }`}
                      onClick={() => setFormData({ ...formData, emailNewNotifications: !formData.emailNewNotifications })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Bell size={18} />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${formData.emailNewNotifications ? 'bg-primary animate-pulse' : 'bg-app-border'}`} />
                      </div>
                      <p className="text-sm font-bold text-app-text mb-1">Intimações Novas</p>
                      <p className="text-[10px] text-app-text-muted leading-relaxed">
                        Notificação diária informando a quantidade de novas intimações encontradas para seus advogados.
                      </p>
                      {formData.emailNewNotifications && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePreviewNewNotifications(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-app-text-muted rounded-lg hover:bg-app-bg transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Eye size={12} />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditNotificationsTemplate(); }}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border text-primary rounded-lg hover:bg-primary/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Code size={12} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={handleTestNewNotifications}
                            disabled={isSendingNewNotificationsTest || !formData.emailUser}
                            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-app-bg border border-app-border text-primary rounded-lg hover:bg-primary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            {isSendingNewNotificationsTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Enviar Teste
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

              {!formData.useExternalSmtp ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3">
                  <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-1">Modo Google Apps Script:</p>
                    <p>O sistema utiliza o serviço nativo do Google Mail (MailApp) associado à conta que publicou o Script. Ideal para envios rápidos e simples usando sua conta Gmail.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-semibold mb-1">Modo SMTP Externo:</p>
                    <p>Permite utilizar servidores de e-mail profissionais (SendGrid, Mailgun, Outlook, servidor próprio). Requer configuração manual dos dados do servidor.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">E-mail de Envio (ou Usuário SMTP)</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.emailUser}
                    onChange={e => setFormData({ ...formData, emailUser: e.target.value })}
                    placeholder="exemplo@gmail.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Senha (ou Senha de App)</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                      value={formData.emailPass}
                      onChange={e => setFormData({ ...formData, emailPass: e.target.value })}
                      placeholder="••••••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {formData.useExternalSmtp && (
                  <>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium text-app-text">Servidor SMTP</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.smtpHost}
                        onChange={e => setFormData({ ...formData, smtpHost: e.target.value })}
                        placeholder="smtp.exemplo.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-app-text">Porta SMTP</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.smtpPort}
                        onChange={e => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 465 })}
                        placeholder="465"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary bg-app-bg"
                          checked={formData.smtpSecure}
                          onChange={e => setFormData({ ...formData, smtpSecure: e.target.checked })}
                        />
                        <span className="text-sm font-medium text-app-text group-hover:text-primary transition-colors">SSL/TLS Seguro</span>
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-app-border space-y-4">
                <div className="max-w-md space-y-1">
                  <label className="text-sm font-medium text-app-text flex items-center">
                    <Send size={14} className="mr-2 text-primary" />
                    Destinatário do Teste
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="flex-1 px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={testRecipient}
                      onChange={e => setTestRecipient(e.target.value)}
                      placeholder="Para quem enviar o teste?"
                    />
                    <button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={isSendingTest || !formData.emailUser}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all font-medium disabled:opacity-50 text-sm whitespace-nowrap"
                    >
                      {isSendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Enviar Teste
                    </button>
                  </div>
                  <p className="text-[10px] text-app-text-muted">Dica: Use seu próprio e-mail para validar rapidamente.</p>
                </div>

                {testStatus && (
                  <div className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${
                    testStatus.success ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {testStatus.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium">{testStatus.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'regional' && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-app-border bg-app-secondary flex items-center">
              <Globe className="mr-2 text-primary" size={20} />
              <h2 className="font-semibold text-app-text">Regional e Fuso Horário</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Timezone Padrão</label>
                <select
                  className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-app-border space-y-4">
                <h3 className="text-sm font-semibold text-app-text">Configurações de Alerta</h3>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Dias para Alerta de Morosidade</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.diasMorosidade}
                      onChange={e => setFormData({ ...formData, diasMorosidade: parseInt(e.target.value) || 30 })}
                    />
                    <span className="text-sm text-app-text-muted whitespace-nowrap">dias sem movimentação</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border space-y-4">
                <h3 className="text-sm font-semibold text-app-text">Visibilidade de Módulos</h3>
                <label className="flex items-center gap-3 p-3 bg-app-bg rounded-xl border border-app-border cursor-pointer hover:bg-app-secondary/50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-primary border-app-border rounded focus:ring-primary bg-app-bg"
                    checked={formData.showMovimentos}
                    onChange={e => setFormData({ ...formData, showMovimentos: e.target.checked })}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-app-text">Módulo de Movimentações</p>
                    <p className="text-xs text-app-text-muted">Exibir menu e aba de movimentações processuais globalmente.</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-app-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-app-text flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Autenticação Oficial Google (OAuth 2.0 Client ID)
                  </h3>
                </div>
                <p className="text-xs text-app-text-muted leading-relaxed">
                  Insira o <strong>Client ID OAuth 2.0</strong> gerado no Google Cloud Console para ativar o popup oficial de login com um clique para todos os advogados e membros do escritório.
                </p>
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Ex: 123456789-abcdef.apps.googleusercontent.com"
                    value={formData.googleClientId || ''}
                    onChange={e => setFormData({ ...formData, googleClientId: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  />
                  <p className="text-[11px] text-app-text-muted">
                    Origem JavaScript autorizada: <code className="bg-app-secondary px-1.5 py-0.5 rounded text-[10px]">{window.location.origin}</code>
                  </p>
                </div>
              </div>

              {/* Controle de Versão do Sistema & Sincronização */}
              <div className="pt-4 border-t border-app-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-app-text flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-primary" />
                    Versão do Sistema & Sincronização
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                    Build Local: v{CURRENT_APP_VERSION}
                  </span>
                </div>
                <p className="text-xs text-app-text-muted leading-relaxed">
                  Controle de versão do aplicativo sincronizado com a planilha do Google. Caso a versão configurada na planilha seja superior à versão em execução no navegador, o sistema alertará os usuários com um banner solicitando a atualização imediata.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-app-bg border border-app-border rounded-xl">
                    <span className="text-[11px] uppercase tracking-wider text-app-text-muted font-bold block mb-1">
                      Versão do Cliente (Executando)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono font-bold text-app-text">v{CURRENT_APP_VERSION}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        Ativa no Navegador
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-app-bg border border-app-border rounded-xl">
                    <span className="text-[11px] uppercase tracking-wider text-app-text-muted font-bold block mb-1">
                      Versão Global na Planilha
                    </span>
                    <div className="flex items-center gap-2">
                      {isAdmin() ? (
                        <input
                          type="text"
                          value={formData.appVersion || ''}
                          onChange={e => setFormData({ ...formData, appVersion: e.target.value.trim() })}
                          placeholder={`Ex: ${CURRENT_APP_VERSION}`}
                          className="w-full px-2.5 py-1 text-sm font-mono border border-app-border bg-app-surface text-app-text rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      ) : (
                        <span className="text-lg font-mono font-bold text-app-text">
                          {formData.appVersion ? `v${formData.appVersion}` : 'Não configurada'}
                        </span>
                      )}
                    </div>
                    {isAdmin() && (
                      <p className="text-[10px] text-app-text-muted mt-1">
                        Dica: Altere este valor para forçar todos os clientes a exibirem o aviso de atualização.
                      </p>
                    )}
                  </div>
                </div>

                {/* Status da Checagem */}
                {(() => {
                  const check = checkAppVersion(formData.appVersion, CURRENT_APP_VERSION);
                  return (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                      check.isOutdated
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {check.isOutdated ? (
                          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        ) : (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span>
                          {check.isOutdated 
                            ? `Versão desatualizada em relação à planilha (Planilha: v${check.remoteVersion}). O banner de atualização está ativo para os clientes.`
                            : 'O cliente local está alinhado com a versão da planilha do Google.'
                          }
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => reloadAppForUpdate()}
                        className="px-3 py-1 bg-app-surface hover:bg-app-secondary border border-app-border rounded-lg font-medium text-app-text transition-colors whitespace-nowrap self-end sm:self-auto"
                        title="Limpar cache e recarregar sistema"
                      >
                        Recarregar Limpo
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <ImportTab />
        )}

        {/* Bloqueio de interface removido para centralizar no Perfil/Preferências */}

        {activeTab !== 'import' && (
          <div className="flex items-center justify-end space-x-4">
            {isSaved && (
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center">
                <Save size={16} className="mr-1" />
                Configurações salvas com sucesso!
              </span>
            )}
            <button
              type="submit"
              className="bg-primary hover:opacity-90 text-white px-6 py-2 rounded-lg flex items-center transition-all shadow-sm active:scale-95"
            >
              <Save size={20} className="mr-2" />
              Salvar Configurações
            </button>
          </div>
        )}
      </form>

      {/* Modal de Preview de E-mail */}
      <Modal 
        isOpen={isPreviewModalOpen} 
        onClose={() => setIsPreviewModalOpen(false)} 
        title={previewContent.title}
        maxWidth="max-w-4xl"
      >
        <div className="bg-white p-4 rounded-lg overflow-auto max-h-[70vh]">
          <div dangerouslySetInnerHTML={{ __html: previewContent.html }} />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setIsPreviewModalOpen(false)}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all font-medium"
          >
            Fechar Visualização
          </button>
        </div>
      </Modal>

      {/* Modal de Editor de Template */}
      <Modal
        isOpen={isTemplateEditorOpen}
        onClose={() => setIsTemplateEditorOpen(false)}
        title={editingTemplate.title}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">Sintaxe de Variáveis Disponíveis:</p>
            <div className="flex flex-wrap gap-2">
              {editingTemplate.placeholders.map(p => (
                <code key={p} className="px-1.5 py-0.5 bg-white dark:bg-app-bg rounded border border-blue-200 dark:border-blue-700 text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                  {p}
                </code>
              ))}
            </div>
          </div>
          
          <div className="relative">
            <textarea
              className="w-full h-[50vh] p-4 font-mono text-xs border border-app-border bg-app-bg text-app-text rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              value={editingTemplate.content}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
              placeholder="Digite o código HTML do template..."
              spellCheck={false}
            />
          </div>

          <div className="flex justify-between items-center bg-app-secondary p-3 rounded-lg">
            <p className="text-[10px] text-app-text-muted italic">Atenção: Use HTML válido para garantir que o e-mail seja renderizado corretamente.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsTemplateEditorOpen(false)}
                className="px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-primary/20"
              >
                Salvar Template
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
