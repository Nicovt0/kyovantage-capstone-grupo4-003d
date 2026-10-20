/**
 * Servicio para obtener el valor de la UF (Unidad de Fomento) desde mindicador.cl
 * API pública, gratuita, sin API Key.
 */

const UF_API_BASE = 'https://mindicador.cl/api';

// Cache en memoria: { valor, timestamp }
let ufCache: { value: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene el valor actual de la UF en CLP.
 * Usa cache de 5 minutos para no saturar la API.
 */
export async function getUFValue(): Promise<number> {
  // Revisar cache
  if (ufCache && Date.now() - ufCache.timestamp < CACHE_TTL_MS) {
    return ufCache.value;
  }

  try {
    const res = await fetch(UF_API_BASE);
    if (!res.ok) throw new Error(`mindicador.cl respondió con ${res.status}`);

    const data = await res.json();
    const ufValue = data?.uf?.valor;

    if (typeof ufValue !== 'number' || ufValue <= 0) {
      throw new Error('Valor de UF inválido en la respuesta');
    }

    ufCache = { value: ufValue, timestamp: Date.now() };
    return ufValue;
  } catch (error) {
    console.error('Error al obtener valor UF:', error);

    // Si hay cache expirado, usarlo como fallback
    if (ufCache) {
      console.warn('Usando cache expirado de UF como fallback');
      return ufCache.value;
    }

    // Último recurso: valor aproximado (se actualizará en la próxima llamada exitosa)
    throw new Error('No se pudo obtener el valor de la UF. Verifica tu conexión a internet.');
  }
}

/**
 * Obtiene el valor de la UF para una fecha específica.
 * Útil para recalcular estados de cuenta pasados.
 */
export async function getUFValueForDate(date: Date): Promise<number> {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();

  try {
    const res = await fetch(`${UF_API_BASE}/uf/${dd}-${mm}-${yyyy}`);
    if (!res.ok) throw new Error(`mindicador.cl respondió con ${res.status}`);

    const data = await res.json();
    const serie = data?.serie;

    if (!Array.isArray(serie) || serie.length === 0) {
      // Si no hay dato para esa fecha, usar el valor actual
      return getUFValue();
    }

    return serie[0].valor;
  } catch (error) {
    console.error('Error al obtener UF para fecha:', error);
    return getUFValue();
  }
}
