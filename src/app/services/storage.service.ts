import { Injectable } from '@angular/core';

export type EstadoSincronizacion = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';

export interface EntregaLocal {
  id?: number;
  tareaId: number;
  curso: string;
  tituloTarea: string;
  comentario: string;
  fechaRegistro: string;
  estadoSincronizacion: EstadoSincronizacion;
  intentosSincronizacion: number;
  ultimoError?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly dbName = 'senatiTaskHubDB';
  private readonly dbVersion = 1;
  private readonly storeName = 'entregas';

  /**
   * Abre o inicializa la base de datos IndexedDB
   */
  async abrirDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no está soportado en este entorno.'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('tareaId', 'tareaId', { unique: false });
          store.createIndex('estadoSincronizacion', 'estadoSincronizacion', { unique: false });
          store.createIndex('fechaRegistro', 'fechaRegistro', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Error al abrir IndexedDB (TaskHub):', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Guarda una entrega local con estado inicial PENDIENTE y fecha
   */
  async guardarEntregaLocal(entrega: Omit<EntregaLocal, 'id'>): Promise<number> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const nuevoRegistro: EntregaLocal = {
        ...entrega,
        fechaRegistro: entrega.fechaRegistro || new Date().toISOString(),
        estadoSincronizacion: 'PENDIENTE',
        intentosSincronizacion: entrega.intentosSincronizacion ?? 0,
      };

      const request = store.add(nuevoRegistro);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      transaction.onerror = () => {
        console.error('Error en transacción al guardar entrega:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Lista todas las entregas ordenadas de la más reciente a la más antigua
   */
  async listarEntregas(): Promise<EntregaLocal[]> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const registros: EntregaLocal[] = request.result || [];
        // Ordenar descendente por id o fecha
        registros.sort((a, b) => (b.id || 0) - (a.id || 0));
        resolve(registros);
      };

      request.onerror = () => {
        console.error('Error al listar entregas:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obtiene el detalle de una entrega específica por ID
   */
  async obtenerEntrega(id: number): Promise<EntregaLocal | null> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`Error al obtener entrega con id ${id}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Elimina una entrega física de IndexedDB tras confirmación
   */
  async eliminarEntrega(id: number): Promise<void> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();

      transaction.onerror = () => {
        console.error(`Error al eliminar entrega id ${id}:`, transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Cuenta entregas con estado PENDIENTE
   */
  async contarPendientes(): Promise<number> {
    const entregas = await this.listarEntregas();
    return entregas.filter(e => e.estadoSincronizacion === 'PENDIENTE').length;
  }

  /**
   * Actualiza el estado y metadatos tras un intento real o simulado
   */
  async actualizarEstado(
    id: number,
    estado: EstadoSincronizacion,
    ultimoError?: string
  ): Promise<void> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const entrega: EntregaLocal = getReq.result;
        if (!entrega) {
          reject(new Error(`No se encontró entrega con id ${id}`));
          return;
        }

        entrega.estadoSincronizacion = estado;
        entrega.intentosSincronizacion = (entrega.intentosSincronizacion || 0) + 1;
        if (ultimoError !== undefined) {
          entrega.ultimoError = ultimoError;
        }

        const putReq = store.put(entrega);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }
}
