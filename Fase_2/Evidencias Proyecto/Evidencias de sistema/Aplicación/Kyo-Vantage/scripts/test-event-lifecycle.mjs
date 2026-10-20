import assert from 'node:assert/strict';
process.env.VITE_USE_MOCKS = process.env.VITE_USE_MOCKS ?? 'true';

import {
  createRecurringTemplate,
  getUpcomingTemplates,
  updateRecurringTemplateStatus,
  payAgendaOccurrence,
  deleteRecurringTemplate,
} from '../src/modules/agenda/services/eventRepository.ts';

console.log('='.repeat(60));
console.log('🚀 INICIANDO PRUEBA DE CICLO COMPLETO DE EVENT REPOSITORY');
console.log('='.repeat(60));

const testUserId = 'test-user-dev-' + Date.now();

try {
  // 1. Creación de plantillas con cuentas y tarjetas vinculadas
  console.log('\n📝 1. Creando plantillas recurrentes vinculadas:');
  
  const template1 = await createRecurringTemplate({
    user_id: testUserId,
    title: 'Dividendo Hogar',
    amount: 520000,
    frequency: 'monthly',
    payment_day: 5,
    status: 'pending',
    type: 'expense',
    account_id: 'acc-1',
    is_essential: true,
  });
  console.log(`   ✅ Creado: "${template1.title}" - $${template1.amount.toLocaleString('es-CL')} (Día ${template1.payment_day}) - Estado: ${template1.status} - ID: ${template1.id}`);

  const template2 = await createRecurringTemplate({
    user_id: testUserId,
    title: 'Spotify Familiar',
    amount: 6590,
    frequency: 'monthly',
    payment_day: 20,
    status: 'pending',
    type: 'expense',
    credit_card_id: 'card-1',
    is_essential: false,
  });
  console.log(`   ✅ Creado: "${template2.title}" - $${template2.amount.toLocaleString('es-CL')} (Día ${template2.payment_day}) - Tarjeta vinculada: ${template2.credit_card_id}`);

  const template3 = await createRecurringTemplate({
    user_id: testUserId,
    title: 'Seguro Automotriz Único',
    amount: 180000,
    frequency: 'once',
    due_date: '2026-10-18',
    status: 'pending',
    type: 'expense',
  });
  console.log(`   ✅ Creado: "${template3.title}" - $${template3.amount.toLocaleString('es-CL')} (Vence: ${template3.due_date})`);

  // 2. Obtener compromisos activos del ciclo de Octubre 2026
  console.log('\n📅 2. Consultando compromisos activos para ciclo Octubre 2026:');
  const octStart = new Date('2026-10-01T00:00:00');
  const octEnd = new Date('2026-10-31T23:59:59');
  
  let octTemplates = await getUpcomingTemplates(testUserId, octStart, octEnd);
  console.log(`   📊 Total encontrados en ciclo Octubre: ${octTemplates.length}`);
  octTemplates.forEach((t, i) => {
    console.log(`      [${i + 1}] Fecha calculada: ${t.due_date} | ${t.title} | $${t.amount.toLocaleString('es-CL')} | Estado: ${t.status}`);
  });

  if (octTemplates.length < 3) {
    throw new Error(`Se esperaban al menos 3 compromisos en Octubre, se obtuvieron ${octTemplates.length}`);
  }

  // El estado pagado requiere registrar el movimiento; no se cambia directamente.
  console.log(`\n💳 3. Registrando el pago de "${template1.title}":`);
  await assert.rejects(updateRecurringTemplateStatus(template1.id, 'paid'), /Registrar pago/);
  const transactionId = await payAgendaOccurrence({
    id: template1.id,
    occurrenceDate: '2026-10-05',
    accountId: 'acc-1',
  });
  assert.ok(transactionId);

  // Verificar en la consulta del ciclo
  octTemplates = await getUpcomingTemplates(testUserId, octStart, octEnd);
  const reloaded1 = octTemplates.find(t => t.id === template1.id);
  assert.equal(reloaded1?.status, 'paid');
  console.log(`   🔍 Verificación en ciclo: ${reloaded1?.title} ahora figura con estado "${reloaded1?.status}"`);

  // 4. Eliminar una plantilla
  console.log(`\n🗑️  4. Eliminando plantilla recurrente "${template2.title}" (ID: ${template2.id}):`);
  await deleteRecurringTemplate(template2.id);
  console.log('   ✅ Eliminado con éxito.');

  octTemplates = await getUpcomingTemplates(testUserId, octStart, octEnd);
  const existsDeleted = octTemplates.some(t => t.id === template2.id);
  console.log(`   🔍 ¿Sigue existiendo en el ciclo?: ${existsDeleted ? '❌ SÍ (Error)' : '✅ NO (Correctamente removida)'}`);

  // 5. Verificar proyección para el siguiente ciclo (Noviembre 2026)
  console.log('\n⏭️  5. Consultando ciclo Noviembre 2026 (Verificar exclusión de tipo "once" y recurrencia de "monthly"):');
  const novStart = new Date('2026-11-01T00:00:00');
  const novEnd = new Date('2026-11-30T23:59:59');
  const novTemplates = await getUpcomingTemplates(testUserId, novStart, novEnd);

  console.log(`   📊 Total encontrados en ciclo Noviembre: ${novTemplates.length}`);
  novTemplates.forEach((t, i) => {
    console.log(`      [${i + 1}] Fecha calculada: ${t.due_date} | ${t.title} | $${t.amount.toLocaleString('es-CL')} (${t.frequency})`);
  });

  const onceInNov = novTemplates.some(t => t.id === template3.id);
  if (onceInNov) {
    throw new Error('❌ Error: El compromiso "once" de Octubre no debió aparecer en Noviembre.');
  } else {
    console.log('   ✅ El compromiso de pago único ("once") de Octubre NO apareció en Noviembre (comportamiento correcto).');
  }

  // Limpieza final
  await deleteRecurringTemplate(template1.id);
  await deleteRecurringTemplate(template3.id);

  console.log('\n' + '='.repeat(60));
  console.log('✨ TODAS LAS PRUEBAS DEL SERVICIO SE COMPLETARON CON ÉXITO');
  console.log('='.repeat(60) + '\n');
} catch (err) {
  console.error('\n❌ ERROR EN LA PRUEBA:', err);
  process.exit(1);
}
