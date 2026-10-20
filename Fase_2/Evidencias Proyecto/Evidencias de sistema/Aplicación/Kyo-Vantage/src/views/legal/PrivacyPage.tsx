import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/home/Navbar';
import { Footer } from '@/components/home/Footer';

export default function PrivacyPolicyPage() {
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
            Política de Privacidad y Protección de Datos Personales
          </h1>
          <p className="text-gray-500 mb-12">Última actualización: Julio, 2026</p>

          <div className="space-y-10 text-base md:text-lg font-light leading-relaxed">
            <p>
              El presente documento regula el tratamiento de datos personales de los usuarios por parte de Kyo Vantage (en adelante, "la Aplicación"), en estricto cumplimiento de la legislación chilena vigente (Ley N° 19.628 y Ley N° 21.719 sobre protección de datos personales), alineándose de forma nativa con los más altos estándares internacionales de transparencia, minimización y seguridad digital.
            </p>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Consentimiento Explícito del Usuario</h2>
              <p>
                Al registrarse y utilizar la Aplicación, el usuario otorga su consentimiento expreso, libre, inequívoco e informado para la recopilación, almacenamiento y procesamiento de sus datos bajo las finalidades exclusivas descritas en este documento. Kyo Vantage no tratará ningún tipo de información sin la autorización previa y explícita del titular.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Datos Recopilados y Principio de Minimización</h2>
              <p className="mb-4">
                La Aplicación recopila de forma exclusiva la información estrictamente necesaria para su correcto funcionamiento técnico y el despliegue de sus herramientas analíticas de Inteligencia Artificial:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Datos de Identificación:</strong> Nombre de usuario y dirección de correo electrónico, utilizados únicamente para la autenticación, control de accesos y seguridad del perfil.
                </li>
                <li>
                  <strong className="text-white">Datos Financieros Operacionales:</strong> Saldos líquidos, metas de ahorro, presupuestos y registros históricos de movimientos monetarios ingresados de forma manual o automatizada mediante las fuentes de ingesta del sistema.
                </li>
                <li>
                  <strong className="text-white">Garantía de Cero Almacenamiento de Credenciales:</strong> Kyo Vantage no solicita, no recopila y nunca almacenará contraseñas bancarias directas, claves de internet, ni contraseñas de archivos PDF basados en combinaciones de RUT para acceder a tus cuentas. El procesamiento se ejecuta sobre datos puramente transaccionales estructurados en texto plano.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Finalidad del Tratamiento de Datos</h2>
              <p className="mb-4">
                La finalidad exclusiva de la recolección de información es proveer el servicio central de ordenamiento financiero:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Procesamiento Analítico Dedicado:</strong> Los datos son procesados de forma privada por nuestra API interna en Python para alimentar de manera automatizada los modelos de Machine Learning denominados Kyo Score y Kyo Advisor. El único propósito es entregar diagnósticos analíticos de salud financiera y alertas predictivas de ahorro en tiempo real.
                </li>
                <li>
                  <strong className="text-white">Prohibición Absoluta de Comercialización:</strong> Toda la información se utiliza exclusivamente para brindar el servicio personal del usuario. Kyo Vantage no vende, no arrienda, no comparte ni comercializa los datos financieros personales o de consumo con entidades bancarias, instituciones comerciales o empresas de publicidad de terceros.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Seguridad Avanzada y Aislamiento Lógico (RLS)</h2>
              <p className="mb-4">
                Para resguardar la confidencialidad de la información con los estándares de una empresa de tecnología consolidada, el ecosistema implementa medidas de ciberseguridad avanzada:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Aislamiento Estricto por Fila (RLS):</strong> Las bases de datos operan bajo políticas estrictas de Row Level Security (RLS) nativas a nivel de motor relacional serverless. Esto garantiza que cada registro financiero está blindado y completamente aislado a nivel de fila por el identificador único de usuario (UUID), haciendo que la base de datos sea completamente ciega ante accesos cruzados o fugas internas de información.
                </li>
                <li>
                  <strong className="text-white">Cifrado de Extremo a Extremo:</strong> Toda transferencia de datos entre el cliente (SPA/Mobile) y la infraestructura en la nube viaja cifrada mediante protocolos seguros de comunicación (HTTPS/TLS).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Derechos del Usuario (Acceso, Rectificación, Cancelación y Portabilidad)</h2>
              <p className="mb-4">
                En conformidad con la normativa chilena y los estándares RGPD, el usuario puede ejercer de manera autónoma e inmediata sus derechos sobre sus datos desde el perfil de la aplicación o mediante solicitud formal:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Acceso y Rectificación:</strong> Derecho a visualizar, modificar y corregir en tiempo real cualquier dato de su historial financiero.
                </li>
                <li>
                  <strong className="text-white">Portabilidad de Datos:</strong> Derecho a solicitar y descargar una copia completa de sus datos históricos personales y transaccionales en un formato estructurado de lectura mecánica estándar (JSON o CSV).
                </li>
                <li>
                  <strong className="text-white">Derecho al Olvido (Borrado Total Inmediato):</strong> El usuario tiene el derecho absoluto a eliminar permanentemente su cuenta. La infraestructura cuenta con un mecanismo automatizado de borrado en cascada (ON DELETE CASCADE) en sus servidores en la nube. Al confirmar la eliminación, el perfil, credenciales y la totalidad de los registros financieros lógicos indexados se borran de forma definitiva, irreversible y permanente en un plazo máximo de 72 horas, cesando de inmediato cualquier tipo de tratamiento.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
