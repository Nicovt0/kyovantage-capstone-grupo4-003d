# Kyo Vantage 💎

> **Domina tu dinero. Conquista tu futuro.**

**Kyo Vantage** no es simplemente otro gestor de gastos más. Es tu **simulador financiero personal** diseñado para ayudarte a construir disciplina financiera hoy, para que las instituciones bancarias no te rechacen mañana. La aplicación te evalúa, gestiona tus presupuestos y te "cobra" tus ahorros como si fuera una institución real, preparándote para el mundo financiero.

Actualmente nos encontramos en **Fase de Beta Cerrada V1.0** (Junio - Agosto).

## 🚀 Funcionalidades Activas

- **Billetera Inteligente**: Registra ingresos y gastos al instante para conocer tu disponibilidad real.
- **Gestión de Presupuestos**: Asigna límites mensuales a tus categorías con alertas inteligentes.
- **Metas de Ahorro (Cobro Automático)**: Configura metas y deja que la aplicación te "cobre" tu ahorro mensual simulando la rigurosidad de un crédito.
- **Agenda Financiera**: Calendario consolidado con tus cobros de metas, presupuestos y pagos recurrentes.
- **Control de Tarjetas de Crédito**: Seguimiento de fechas de facturación, cupos y cuotas pendientes para evitar intereses.

## 🔜 Próximamente (Kyo Pro)

- **Kyo Score**: Tu puntuación crediticia simulada basada en tu comportamiento en la plataforma.
- **Kyo Advisor (IA)**: Un asesor financiero inteligente que analizará tus hábitos y te dará diagnósticos certeros.

## 🛡️ El Compromiso Kyo

Tus finanzas son sagradas. Nuestro compromiso inquebrantable es que **jamás venderemos, alquilaremos ni compartiremos tus datos personales o financieros** bajo ninguna situación. Tú eres el único dueño de tu información. Kyo Vantage funciona de manera 100% independiente de tus bancos.

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 19 + Vite 6 (SPA)
- **Navegación**: React Router 7
- **Consultas y caché en memoria**: TanStack Query 5
- **PWA**: vite-plugin-pwa (Workbox)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/)
- **Base de Datos / Backend**: [Supabase](https://supabase.com/)
- **Iconos**: [Lucide React](https://lucide.dev/)

La aplicación utiliza React Router y un shell persistente para las rutas privadas. La arquitectura y autenticación se documentan en [docs/SPA.md](docs/SPA.md); el estado de instalación y caché se describe en [docs/PWA.md](docs/PWA.md).

## 💻 Comenzar a Desarrollar

Primero, instala las dependencias:

```bash
npm install
```

Copia `.env.example` a `.env.local` y configura las variables públicas `VITE_*` de Supabase staging. Nunca incluyas secretos ni claves `service_role`.

Luego, inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Validación

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Las pruebas PWA inspeccionan `dist`; ejecutar el build primero.
