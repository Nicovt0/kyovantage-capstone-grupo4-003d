import { createClient } from 'npm:@supabase/supabase-js@2.48.0';

export async function handleDailyInterest(request: Request) {
  // 1. Verificación de Seguridad (CRON_SECRET)
  // Vercel o Supabase envía un header Authorization: Bearer CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const isAuthorized = authHeader === `Bearer ${cronSecret}`;
  if (!isAuthorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return Response.json({ error: 'Supabase server credentials are not configured' }, { status: 500 });
    }
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Obtener todos los estados de cuenta pendientes o parciales
    const { data: statements, error: fetchError } = await supabase
      .from('billing_statements')
      .select('*, credit_cards(id, monthly_interest_rate, default_interest_rate)')
      .in('status', ['pending', 'partial']);

    if (fetchError) throw fetchError;

    let processedCount = 0;
    const now = new Date();

    for (const stmt of (statements || [])) {
      const card = stmt.credit_cards;
      if (!card || Array.isArray(card)) continue;

      const dueDate = new Date(stmt.payment_due_date);
      const isOverdue = now > dueDate;

      let dailyInterest = 0;
      let daysLate = 0;

      if (isOverdue) {
        // Interés por Mora (sobre el total impago)
        const unpaid = stmt.total_due - stmt.amount_paid;
        if (unpaid > 0) {
          // Si no tiene default_interest_rate, usamos 2.9 como fallback realista
          const moraRate = card.default_interest_rate || 2.9;
          const dailyRate = moraRate / 100 / 30;
          dailyInterest = unpaid * dailyRate;
          
          daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        }
      } else {
        // Interés Rotativo (sobre saldo refinanciado que trae del mes anterior)
        if (stmt.refinanced_balance > 0) {
          const dailyRate = card.monthly_interest_rate / 100 / 30;
          dailyInterest = stmt.refinanced_balance * dailyRate;
        }
      }

      if (dailyInterest > 0) {
        const roundedDaily = Math.round(dailyInterest);
        const newInterest = stmt.interest_amount + roundedDaily;
        const newTotalDue = stmt.total_due + roundedDaily;
        const newMinPayment = stmt.minimum_payment + roundedDaily;

        const { error: updateError } = await supabase
          .from('billing_statements')
          .update({
            interest_amount: newInterest,
            total_due: newTotalDue,
            minimum_payment: newMinPayment,
            days_late: isOverdue ? daysLate : 0
          })
          .eq('id', stmt.id);

        if (updateError) {
          console.error(`Error actualizando statement ${stmt.id}:`, updateError);
        } else {
          processedCount++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: `Cron job ejecutado exitosamente. Se procesaron y actualizaron ${processedCount} estados de cuenta con intereses diarios.` 
    });

  } catch (error: any) {
    console.error('Error en el Cron Job de intereses diarios:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

Deno.serve(handleDailyInterest);
