const pt = {
  // App
  appName: 'SpotMaster',
  appSubtitle: 'Veiculação Comercial',

  // Navigation
  nav: {
    playlist: 'Playlist',
    adBreaks: 'Blocos Comerciais',
    clients: 'Anunciantes',
    log: 'Log de Veiculação',
    reports: 'Relatórios',
    settings: 'Configurações',
  },

  // Toolbar
  toolbar: {
    newPlaylist: 'Nova Playlist',
    importPlaylist: 'Importar Playlist',
    exportPlaylist: 'Exportar Playlist',
    savePlaylist: 'Salvar Playlist',
    addItem: 'Adicionar Item',
    addAdBreak: 'Inserir Bloco Comercial',
    clearAll: 'Limpar Tudo',
    theme: 'Tema',
    language: 'Idioma',
    connect: 'Conectar vMix',
    disconnect: 'Desconectar',
    browseVmixInputs: 'Inputs do vMix',
  },

  // Playlist
  playlist: {
    title: 'Playlist',
    empty: 'Nenhum item na playlist. Clique em "Adicionar Item" para começar.',
    columns: {
      order: '#',
      time: 'Horário',
      title: 'Título',
      client: 'Anunciante',
      type: 'Tipo',
      duration: 'Duração',
      endTime: 'Término',
      input: 'Input vMix',
      status: 'Status',
      actions: 'Ações',
    },
    addItem: 'Adicionar Item',
    editItem: 'Editar Item',
    deleteItem: 'Excluir Item',
    playItem: 'Veicular no vMix',
    markDone: 'Marcar como Veiculado',
    markSkipped: 'Marcar como Pulado',
    totalDuration: 'Duração Total',
    itemCount: 'itens',
    playSequence: 'Iniciar Playlist',
    playSingle: 'Play',
    stopPlayback: 'Parar',
    playing: 'Executando',
    autoPlayScheduled: 'Autoplay por Horário',
  },

  // Ad Breaks
  adBreaks: {
    title: 'Blocos Comerciais',
    // Blocks tab
    emptyBlocks: 'Nenhum bloco cadastrado. Crie um bloco para agendar intervalos comerciais automaticamente.',
    newBlock: 'Novo Bloco',
    editBlock: 'Editar Bloco',
    deleteBlock: 'Excluir Bloco',
    blockName: 'Nome do Bloco',
    scheduledTime: 'Horário',
    clientSlots: 'Clientes no Bloco',
    spotsCount: 'Nº de spots',
    forceReload: 'Recarregar Hoje',
    loadedToday: 'Carregado hoje',
    totalDuration: 'Duração Total',
    enabled: 'Ativo',
    // Spots tab
    emptySpots: 'Nenhum spot cadastrado para este anunciante.',
    addSpot: 'Adicionar Spot',
    editSpot: 'Editar Spot',
    deleteSpot: 'Excluir Spot',
    spotTitle: 'Título do Spot',
    spotFile: 'Arquivo',
    spotDuration: 'Duração (s)',
    rotation: 'Rodízio',
    nextSpot: 'Próximo',
    // kept for backward compat
    empty: 'Nenhum bloco cadastrado.',
    insertInPlaylist: 'Inserir na Playlist',
    items: 'Itens',
  },

  // Clients
  clients: {
    title: 'Anunciantes',
    empty: 'Nenhum anunciante cadastrado.',
    newClient: 'Novo Anunciante',
    editClient: 'Editar Anunciante',
    deleteClient: 'Excluir Anunciante',
    name: 'Nome',
    contact: 'Contato',
    email: 'E-mail',
    phone: 'Telefone',
    notes: 'Observações',
    spotCount: 'Spots Veiculados',
  },

  // Log
  log: {
    title: 'Log de Veiculação',
    empty: 'Nenhum registro de veiculação.',
    columns: {
      date: 'Data',
      scheduledTime: 'Horário Prog.',
      actualTime: 'Horário Real',
      title: 'Título',
      client: 'Anunciante',
      duration: 'Duração',
      status: 'Status',
      input: 'Input',
    },
    filterDate: 'Filtrar por data',
    filterClient: 'Filtrar por anunciante',
    clearFilter: 'Limpar Filtro',
    exportCSV: 'Exportar CSV',
  },

  // Reports
  reports: {
    title: 'Relatórios',
    dailyReport: 'Relatório Diário',
    clientReport: 'Relatório por Anunciante',
    generatePDF: 'Gerar PDF',
    selectDate: 'Selecionar Data',
    selectClient: 'Selecionar Anunciante',
    dateFrom: 'De',
    dateTo: 'Até',
    stationName: 'Emissora',
    reportTitle: 'Comprovante de Veiculação',
    generatedAt: 'Gerado em',
    totalSpots: 'Total de Spots',
    totalDuration: 'Duração Total',
    period: 'Período',
    noData: 'Nenhum dado para o período selecionado.',
  },

  // Settings
  settings: {
    title: 'Configurações',
    vmix: 'Integração vMix',
    vmixHost: 'Host vMix',
    vmixPort: 'Porta vMix',
    autoConnect: 'Conectar automaticamente',
    autoPlay: 'Autoplay por horário agendado',
    spotmasterInput: 'Slot de Input no vMix',
    station: 'Dados da Emissora',
    stationName: 'Nome da Emissora',
    appearance: 'Aparência',
    theme: 'Tema',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    language: 'Idioma',
    save: 'Salvar',
    cancel: 'Cancelar',
    testConnection: 'Testar Conexão',
  },

  // Status Bar
  statusBar: {
    vmixConnected: 'vMix Conectado',
    vmixDisconnected: 'vMix Desconectado',
    current: 'Atual',
    next: 'Próximo',
    recording: 'Gravando',
    streaming: 'Ao Vivo',
    nothing: 'Nada',
  },

  // Spot types
  types: {
    spot: 'Spot',
    vinheta: 'Vinheta',
    programa: 'Programa',
    bumper: 'Bumper',
    outros: 'Outros',
  },

  // Spot statuses
  statuses: {
    pending: 'Pendente',
    playing: 'Veiculando',
    done: 'Veiculado',
    skipped: 'Pulado',
    error: 'Erro',
  },

  // Common
  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    add: 'Adicionar',
    close: 'Fechar',
    confirm: 'Confirmar',
    yes: 'Sim',
    no: 'Não',
    search: 'Buscar',
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    name: 'Nome',
    title: 'Título',
    date: 'Data',
    time: 'Horário',
    duration: 'Duração',
    notes: 'Observações',
    actions: 'Ações',
    noItems: 'Nenhum item',
    total: 'Total',
    all: 'Todos',
    confirmDelete: 'Tem certeza que deseja excluir?',
    seconds: 's',
    minutes: 'min',
    videoFile: 'Arquivo de Vídeo',
    browse: 'Procurar...',
    noFileSelected: 'Nenhum arquivo selecionado',
    vmixInputPicker: 'Selecionar Input do vMix',
    vmixInputPickerEmpty: 'Nenhum input encontrado no vMix. Verifique a conexão.',
    vmixInputPickerHint: 'Selecione um input existente do vMix para adicionar à playlist.',
    addToPlaylist: 'Adicionar à Playlist',
  },
}

export default pt
export type Translations = typeof pt
