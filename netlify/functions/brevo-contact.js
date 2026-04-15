exports.handler = async function(event, context) {
  // CORS headers — permite llamadas desde el frontend en GitHub Pages / Netlify
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Validar API key
  if (!process.env.BREVO_API_KEY) {
    console.error('[brevo-contact] BREVO_API_KEY no configurada');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };
  }

  let nombre, correo, negocio;
  try {
    ({ nombre, correo, negocio } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // Validaciones básicas
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email invalido' }) };
  }

  const [firstName, ...rest] = (nombre || correo.split('@')[0]).trim().split(' ');
  const lastName = rest.join(' ') || '';

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: correo,
        firstName: firstName,
        lastName: lastName,
        listIds: [3],
        updateEnabled: true,  // actualiza si ya existe — no falla en duplicados
        attributes: {
          TIPO_NEGOCIO: negocio || 'Generador Indisutex',
          FUENTE: 'generador-prompts'
        }
      })
    });

    // Brevo retorna 201 (creado) o 204 (actualizado). Ambos son exito.
    const isSuccess = response.status === 201 || response.status === 204 || response.ok;

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!isSuccess) {
      console.error('[brevo-contact] Error Brevo:', response.status, data);
    }

    // Siempre retornamos 200 al cliente — un fallo de Brevo no debe bloquear al usuario
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: isSuccess, brevoStatus: response.status })
    };

  } catch (err) {
    console.error('[brevo-contact] Excepcion:', err.message);
    // Retornamos 200 igual — el usuario no debe ver error por esto
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
