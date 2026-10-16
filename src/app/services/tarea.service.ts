import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface Tarea {
  id: number;
  curso: string;
  titulo: string;
  instructor: string;
  fechaEntrega: string;
  estado: 'Pendiente' | 'Completado' | string;
  descripcion?: string;
}

export const TAREAS_DEFAULT: Tarea[] = [
  {
    id: 101,
    curso: "Desarrollo Web PWA",
    titulo: "Entregable 01: Configuración de Service Worker y App Manifest",
    instructor: "Ing. Luque Chambi Jorge",
    fechaEntrega: "2026-10-20",
    estado: "Pendiente",
    descripcion: "Implementar una PWA completa con App Manifest, Service Worker y Cache Storage para funcionamiento offline."
  },
  {
    id: 102,
    curso: "Base de Datos Avanzada",
    titulo: "Laboratorio 03: Script DDL PostgreSQL e IndexedDB",
    instructor: "Ing. Carlos Mendoza",
    fechaEntrega: "2026-10-22",
    estado: "Completado",
    descripcion: "Diseño de base de datos relacional y pruebas de almacenamiento estructurado en cliente."
  },
  {
    id: 103,
    curso: "Inteligencia Artificial Aplicada",
    titulo: "Práctica 02: Clasificación de Modelos Supervisados",
    instructor: "Ing. Luque Chambi Jorge",
    fechaEntrega: "2026-10-25",
    estado: "Pendiente",
    descripcion: "Entrenamiento de modelos con Python y scikit-learn para predicción de abandono estudiantil."
  },
  {
    id: 104,
    curso: "Desarrollo Web PWA",
    titulo: "Entregable 02: Persistencia con IndexedDB y Sincronización Offline",
    instructor: "Ing. Luque Chambi Jorge",
    fechaEntrega: "2026-10-28",
    estado: "Pendiente",
    descripcion: "Bandeja local de entregas con control de transacciones y estados honestos de sincronización."
  },
  {
    id: 105,
    curso: "Redes y Comunicaciones",
    titulo: "Laboratorio 04: Configuración de Subredes IPv6 y Enrutamiento OSPF",
    instructor: "Ing. Roberto Alarcón",
    fechaEntrega: "2026-10-30",
    estado: "Pendiente",
    descripcion: "Simulación en Packet Tracer con topología jerárquica y redundancia."
  },
  {
    id: 106,
    curso: "Seguridad Informática",
    titulo: "Taller 02: Auditoría Web con OWASP ZAP y HTTPS",
    instructor: "Ing. Patricia Flores",
    fechaEntrega: "2026-11-02",
    estado: "Completado",
    descripcion: "Análisis de vulnerabilidades, configuración de certificados SSL/TLS y directivas CSP."
  }
];

@Injectable({
  providedIn: 'root',
})
export class TareaService {
  private http = inject(HttpClient);
  private url = 'data/tareas.json';
  private fallbackUrl = 'assets/data/tareas.json';

  obtenerTareas(): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(this.url).pipe(
      catchError(() => {
        return this.http.get<Tarea[]>(this.fallbackUrl).pipe(
          catchError((err) => {
            console.warn('Usando catálogo estático por contingencia offline:', err);
            return of(TAREAS_DEFAULT);
          })
        );
      })
    );
  }
}
