import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/home/Navbar';
import { Footer } from '@/components/home/Footer';

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-app-background text-gray-900 dark:text-[#f1f0f8] font-sans selection:bg-[#7c3aed]/30 selection:text-[#c4b5fd] overflow-x-hidden flex flex-col relative transition-colors duration-300">
      <Navbar />
      <main className="flex-grow bg-app-background text-gray-300 py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7c3aed] hover:text-[#9b70f7] transition-colors mb-12 font-medium">
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Términos y Condiciones Generales de Uso
          </h1>
          <p className="text-gray-500 mb-12">Última actualización: Julio, 2026</p>

          <div className="space-y-10 text-base md:text-lg font-light leading-relaxed">
            <p>
              Bienvenido a Kyo Vantage. El acceso, registro, descarga y uso de esta interfaz web y aplicación móvil atribuyen la condición de usuario e implican la aceptación total, explícita y sin reservas de la totalidad de las cláusulas establecidas en estos Términos y Condiciones.
            </p>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Descripción y Naturaleza del Servicio</h2>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Entrenador Financiero Automatizado:</strong> Kyo Vantage proporciona herramientas tecnológicas para el registro, centralización, clasificación y visualización predictiva de flujos económicos personales. El sistema aprende de las interacciones del usuario para agilizar el control presupuestario mensual.
                </li>
                <li>
                  <strong className="text-white">Exención de Responsabilidad de IA e Información Informativa:</strong> Las métricas arrojadas por el indicador dinámico de salud financiera Kyo Score (procesado mediante algoritmos matemáticos de clustering K-Means y Clustering Jerárquico) y las alertas emitidas por el motor de detección de anomalías Kyo Advisor tienen un carácter puramente informativo, referencial y orientativo. No producen efectos jurídicos significativos ni vinculantes.
                </li>
                <li>
                  <strong className="text-white">Exclusión de Asesoría Regulada:</strong> Kyo Vantage, sus desarrolladores y sus algoritmos no constituyen una entidad financiera, contable, tributaria ni legal, y no prestan asesoría financiera regulada por la Comisión para el Mercado Financiero (CMF) de Chile. El usuario es el único responsable de auditar la exactitud de sus clasificaciones y de cualquier decisión económica, inversión, contratación de créditos o gestión de deudas que decida realizar en su vida real.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Requisitos de Uso y Responsabilidad del Usuario</h2>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Capacidad Legal:</strong> El usuario declara tener 18 años o más y capacidad legal para utilizar el software.
                </li>
                <li>
                  <strong className="text-white">Veracidad:</strong> El usuario se compromete a ingresar información fidedigna en sus flujos monetarios para el correcto cálculo de los modelos analíticos predictivos.
                </li>
                <li>
                  <strong className="text-white">Resguardo de Credenciales:</strong> El usuario es el único responsable de mantener la confidencialidad de sus accesos y dispositivos. Kyo Vantage no se responsabiliza por accesos no autorizados derivados de la negligencia en la protección de las credenciales de la cuenta.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Propiedad Intelectual</h2>
              <p>
                El software, código fuente, algoritmos base (K-Means, Clustering Jerárquico, Análisis de Componentes Principales - PCA), interfaces gráficas (UI/UX), logotipos, diseños y marcas asociadas a Kyo Vantage son de propiedad intelectual e industrial exclusiva de sus desarrolladores originales (indexados en los repositorios oficiales de la plataforma). Queda estrictamente prohibida su reproducción, alteración, distribución o ingeniería inversa. El usuario mantiene la titularidad de sus datos brutos, otorgando una licencia limitada al sistema para procesarlos con el único fin de prestar el servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Privacidad Empresarial en el Uso de Inteligencia Artificial</h2>
              <p>
                Para procesar la lógica avanzada de datos financieros sin saturar los dispositivos, Kyo Vantage utiliza APIs de servicios externos de Inteligencia Artificial implementadas de forma privada y bajo condiciones empresariales (Enterprise API). Los datos e insights financieros se procesan exclusivamente para ejecutar el servicio personalizado del usuario. Se garantiza de forma contractual que ningún dato personal ni transaccional de los usuarios es utilizado para entrenar modelos de Inteligencia Artificial de propósito general de terceros.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Restricciones de Uso y Suspensión del Servicio</h2>
              <p className="mb-4">
                Kyo Vantage se reserva el derecho de suspender o cancelar de forma inmediata, definitiva y sin previo aviso la cuenta de cualquier usuario que incurra en conductas indebidas, incluyendo:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>Intentos de manipulación, inyección de código malicioso o alteración de las directivas de seguridad (Row Level Security).</li>
                <li>Uso del sistema para actividades fraudulentas, lavado de activos o infracciones a las leyes chilenas e internacionales.</li>
                <li>Interferencias técnicas con la operación de los servidores o la infraestructura en la nube de la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Modificaciones de los Términos</h2>
              <p>
                La plataforma podrá actualizar o modificar estos Términos y Condiciones para adaptarse a mejoras tecnológicas o cambios regulatorios de la legislación chilena. Cualquier cambio relevante será notificado visualmente a los usuarios con anticipación dentro de la interfaz de la SPA y requerirá su lectura previa para continuar utilizando los servicios de manera regular.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
