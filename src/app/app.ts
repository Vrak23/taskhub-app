import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SwUpdate } from '@angular/service-worker';
import { TareaService, Tarea, TAREAS_DEFAULT } from './services/tarea.service';
import { StorageService, EntregaLocal, EstadoSincronizacion } from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  title = 'SENATI TaskHub PWA';

  private tareaService = inject(TareaService);
  private storageService = inject(StorageService);
  private swUpdate = inject(SwUpdate);
  private cdr = inject(ChangeDetectorRef);

  // Estados de conectividad y PWA
  online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  swActivo: boolean = false;
  swMensaje: string = '';

  // Datos de tareas académicas inicializados inmediatamente con datos
  tareas: Tarea[] = [...TAREAS_DEFAULT];
  tareasFiltradas: Tarea[] = [...TAREAS_DEFAULT];
  cursosDisponibles: string[] = [];
  cargandoTareas: boolean = false;

  // Filtros combinables
  busquedaTitulo: string = '';
  cursoSeleccionado: string = 'TODOS';

  // Formulario de entrega
  tareaSeleccionadaId: number | null = null;
  comentarioEntrega: string = '';
  archivoSimuladoNombre: string = '';

  // Validaciones y mensajes
  errorTarea: string = '';
  errorComentario: string = '';
  mensajeNotificacion: { texto: string; tipo: 'success' | 'warning' | 'error' | 'info' } | null = null;

  // Bandeja de entregas locales
  entregas: EntregaLocal[] = [];
  contadorPendientes: number = 0;
  vistaActiva: 'tareas' | 'entregar' | 'bandeja' = 'tareas';

  // Modal de Detalle
  entregaSeleccionadaDetalle: EntregaLocal | null = null;
  mostrarModalDetalle: boolean = false;

  // Modal de Confirmación de Eliminación
  entregaAEliminar: EntregaLocal | null = null;
  mostrarModalEliminar: boolean = false;

  // Sincronización
  reintentandoSincronizacion: boolean = false;
  mensajeSincronizacionExplicativa: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online = true;
        this.onCambioConectividad();
      });
      window.addEventListener('offline', () => {
        this.online = false;
        this.onCambioConectividad();
      });
    }
  }

  ngOnInit(): void {
    this.extraerCursos();
    this.aplicarFiltros();
    this.verificarServiceWorker();
    this.cargarTareas();
    this.cargarBandejaEntregas();
  }

  // --- SERVICE WORKER ---
  verificarServiceWorker(): void {
    if (this.swUpdate.isEnabled) {
      this.swActivo = true;
      this.swMensaje = 'Angular Service Worker activo y cacheando recursos (ngsw-worker.js)';
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          if (confirm('Nueva versión de SENATI TaskHub disponible. ¿Actualizar ahora?')) {
            window.location.reload();
          }
        }
      });
    } else {
      this.swActivo = false;
      this.swMensaje = 'Service Worker no activo (entorno de desarrollo sin SSL/localhost o navegador sin soporte).';
    }
  }

  // --- CONTROL DE CONEXIÓN Y SINCRONIZACIÓN HONESTA ---
  toggleSimuladorConexion(): void {
    this.online = !this.online;
    this.onCambioConectividad();
  }

  onCambioConectividad(): void {
    if (this.online) {
      this.mensajeSincronizacionExplicativa =
        'Con conexión disponible. Listo para intentar sincronizar con el servidor SENATI.';
      this.mostrarNotificacion(
        'Conexión recuperada. Las entregas locales se mantienen en estado PENDIENTE hasta confirmación de API.',
        'info'
      );
    } else {
      this.mensajeSincronizacionExplicativa =
        'Modo sin conexión activado. Todas las entregas se guardarán localmente en IndexedDB.';
      this.mostrarNotificacion(
        'Estás trabajando sin conexión. Tus entregas están seguras en este dispositivo.',
        'warning'
      );
    }
    this.cdr.detectChanges();
  }

  // --- CARGA Y FILTRADO DE TAREAS (TH-01) ---
  cargarTareas(): void {
    this.tareaService.obtenerTareas().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.tareas = data;
          this.extraerCursos();
          this.aplicarFiltros();
        }
        this.cargandoTareas = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Error al obtener tareas remotas; conservando datos base:', err);
        this.cargandoTareas = false;
        this.aplicarFiltros();
        this.cdr.detectChanges();
      },
      complete: () => {
        this.cargandoTareas = false;
        this.cdr.detectChanges();
      }
    });
  }

  extraerCursos(): void {
    const cursosSet = new Set<string>();
    this.tareas.forEach((t) => {
      if (t.curso) cursosSet.add(t.curso);
    });
    this.cursosDisponibles = Array.from(cursosSet);
  }

  aplicarFiltros(): void {
    this.tareasFiltradas = this.tareas.filter((t) => {
      const matchTitulo =
        !this.busquedaTitulo.trim() ||
        t.titulo.toLowerCase().includes(this.busquedaTitulo.trim().toLowerCase()) ||
        t.instructor.toLowerCase().includes(this.busquedaTitulo.trim().toLowerCase());

      const matchCurso =
        this.cursoSeleccionado === 'TODOS' ||
        t.curso.toLowerCase() === this.cursoSeleccionado.toLowerCase();

      return matchTitulo && matchCurso;
    });
  }

  limpiarFiltros(): void {
    this.busquedaTitulo = '';
    this.cursoSeleccionado = 'TODOS';
    this.aplicarFiltros();
  }

  // --- FORMULARIO Y VALIDACIÓN DE ENTREGA (TH-02, TH-04) ---
  seleccionarParaEntregar(tarea: Tarea): void {
    this.tareaSeleccionadaId = tarea.id;
    this.errorTarea = '';
    this.errorComentario = '';
    this.vistaActiva = 'entregar';
  }

  get tareaSeleccionada(): Tarea | undefined {
    return this.tareas.find((t) => t.id === Number(this.tareaSeleccionadaId));
  }

  simularSeleccionArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSimuladoNombre = input.files[0].name;
    }
  }

  async guardarEntrega(): Promise<void> {
    this.errorTarea = '';
    this.errorComentario = '';

    // Validación obligatoria de tarea
    if (!this.tareaSeleccionadaId) {
      this.errorTarea = 'Debe seleccionar una tarea académica para realizar la entrega.';
    }

    // Validación obligatoria de comentario no vacío
    if (!this.comentarioEntrega || !this.comentarioEntrega.trim()) {
      this.errorComentario = 'El comentario o justificación de entrega no puede estar vacío.';
    }

    if (this.errorTarea || this.errorComentario) {
      this.mostrarNotificacion('Por favor complete los campos obligatorios del formulario.', 'error');
      return;
    }

    const tarea = this.tareaSeleccionada;
    if (!tarea) {
      this.errorTarea = 'La tarea seleccionada no es válida.';
      return;
    }

    // Preparar objeto EntregaLocal según especificación TH-03, TH-04
    const nuevaEntrega: Omit<EntregaLocal, 'id'> = {
      tareaId: tarea.id,
      curso: tarea.curso,
      tituloTarea: tarea.titulo,
      comentario: this.comentarioEntrega.trim(),
      fechaRegistro: new Date().toISOString(),
      estadoSincronizacion: 'PENDIENTE', // Siempre inicia PENDIENTE
      intentosSincronizacion: 0,
      ultimoError: undefined,
    };

    try {
      const idGenerado = await this.storageService.guardarEntregaLocal(nuevaEntrega);
      console.log(`Entrega #${idGenerado} persistida exitosamente en IndexedDB`);

      await this.cargarBandejaEntregas();

      // Mensaje coherente según reglas (TH-06)
      if (this.online) {
        this.mostrarNotificacion(
          `Entrega #${idGenerado} guardada localmente en IndexedDB. [Con conexión: listo para intentar sincronizar cuando el servidor esté disponible].`,
          'success'
        );
      } else {
        this.mostrarNotificacion(
          `Entrega #${idGenerado} guardada con éxito en el dispositivo (IndexedDB). Estado inicial: PENDIENTE.`,
          'success'
        );
      }

      // Limpiar formulario y navegar a la bandeja
      this.comentarioEntrega = '';
      this.archivoSimuladoNombre = '';
      this.vistaActiva = 'bandeja';
    } catch (error) {
      console.error('Error al persistir entrega en IndexedDB:', error);
      this.mostrarNotificacion('Error de almacenamiento en IndexedDB: No se pudo guardar la entrega.', 'error');
    }
  }

  // --- BANDEJA LOCAL Y CONTADOR DE PENDIENTES (TH-03, TH-05) ---
  async cargarBandejaEntregas(): Promise<void> {
    try {
      this.entregas = await this.storageService.listarEntregas();
      this.contadorPendientes = await this.storageService.contarPendientes();
    } catch (err) {
      console.error('Error al cargar entregas desde IndexedDB:', err);
      this.entregas = [];
      this.contadorPendientes = 0;
    }
  }

  // --- REINTENTO CONTROLADO Y CONTROL HONESTO DE SINCRONIZACIÓN (TH-06) ---
  async reintentarSincronizacion(): Promise<void> {
    if (!this.online) {
      this.mostrarNotificacion('No hay conexión de red. Reconéctate para intentar sincronizar.', 'warning');
      return;
    }

    if (this.contadorPendientes === 0) {
      this.mostrarNotificacion('No hay entregas pendientes de sincronización.', 'info');
      return;
    }

    this.reintentandoSincronizacion = true;
    this.mostrarNotificacion('Contactando endpoint de sincronización SENATI...', 'info');

    // Simulación honesta: No hay API real conectada
    setTimeout(async () => {
      try {
        const pendientes = this.entregas.filter((e) => e.estadoSincronizacion === 'PENDIENTE');

        for (const p of pendientes) {
          if (p.id) {
            // Se actualizan intentos pero se MANTIENE PENDIENTE con nota explicativa
            await this.storageService.actualizarEstado(
              p.id,
              'PENDIENTE',
              'Servidor SENATI sin endpoint REST activo. Se mantiene en cola local de IndexedDB.'
            );
          }
        }

        await this.cargarBandejaEntregas();
        this.reintentandoSincronizacion = false;
        this.mostrarNotificacion(
          'Reintento finalizado: Sin API real configurada, los registros conservan estado PENDIENTE según especificación.',
          'warning'
        );
      } catch (e) {
        this.reintentandoSincronizacion = false;
        console.error('Error durante reintento:', e);
      }
    }, 1200);
  }

  // --- DETALLE DE ENTREGA ---
  abrirDetalle(entrega: EntregaLocal): void {
    this.entregaSeleccionadaDetalle = entrega;
    this.mostrarModalDetalle = true;
  }

  cerrarDetalle(): void {
    this.mostrarModalDetalle = false;
    this.entregaSeleccionadaDetalle = null;
  }

  // --- ELIMINACIÓN CONFIRMADA (TH-07) ---
  solicitarEliminacion(entrega: EntregaLocal, event?: Event): void {
    if (event) event.stopPropagation();
    this.entregaAEliminar = entrega;
    this.mostrarModalEliminar = true;
  }

  cancelarEliminacion(): void {
    this.mostrarModalEliminar = false;
    this.entregaAEliminar = null;
  }

  async confirmarEliminacion(): Promise<void> {
    if (!this.entregaAEliminar || !this.entregaAEliminar.id) return;

    try {
      const id = this.entregaAEliminar.id;
      await this.storageService.eliminarEntrega(id);
      this.mostrarModalEliminar = false;
      this.entregaAEliminar = null;
      if (this.entregaSeleccionadaDetalle?.id === id) {
        this.cerrarDetalle();
      }
      await this.cargarBandejaEntregas();
      this.mostrarNotificacion(`Entrega #${id} eliminada correctamente de IndexedDB.`, 'info');
    } catch (err) {
      console.error('Error al eliminar entrega:', err);
      this.mostrarNotificacion('Error al intentar eliminar la entrega en IndexedDB.', 'error');
    }
  }

  // --- AUXILIARES ---
  formatearFecha(isoString: string): string {
    if (!isoString) return '-';
    try {
      const fecha = new Date(isoString);
      return fecha.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  mostrarNotificacion(texto: string, tipo: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    this.mensajeNotificacion = { texto, tipo };
    setTimeout(() => {
      if (this.mensajeNotificacion?.texto === texto) {
        this.mensajeNotificacion = null;
      }
    }, 5000);
  }

  cerrarNotificacion(): void {
    this.mensajeNotificacion = null;
  }
}
