const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * Devuelve una pagina de diagnostico para probar el flujo HTTP del cliente
 * movil sin recompilar la app.
 *
 * POR QUE:
 * - si el navegador del celular llega al backend, podemos aislar si falla la
 *   red, el metodo POST o la app instalada
 * - evita rebuilds a ciegas y convierte el problema en evidencia observable
 */
export const buildCodigoEstelarMobileDebugPage = ({
  suggestedApiBaseUrl,
  suggestedQrToken = '',
  suggestedDifficulty = 2,
}) => `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Debug móvil Código Estelar</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --panel: #101b2e;
        --line: rgba(130, 215, 255, 0.14);
        --text: #f8fbff;
        --muted: rgba(255, 255, 255, 0.64);
        --accent: #18c47a;
        --accent-2: #82d7ff;
        --error: #ff8a8a;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        padding: 20px;
      }

      .shell {
        max-width: 860px;
        margin: 0 auto;
        display: grid;
        gap: 16px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 12px;
      }

      h1, h2, p { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 18px; }
      p, li, label { color: var(--muted); line-height: 1.5; }
      ul { margin: 0; padding-left: 18px; }

      .grid {
        display: grid;
        gap: 12px;
      }

      input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.05);
        color: var(--text);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      button {
        border: 0;
        border-radius: 12px;
        padding: 12px 16px;
        background: var(--accent);
        color: #062312;
        font-weight: 700;
      }

      button.secondary {
        background: rgba(255,255,255,0.08);
        color: var(--text);
      }

      .status-list {
        display: grid;
        gap: 10px;
      }

      .status-item {
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
      }

      .status-item strong {
        display: block;
        margin-bottom: 4px;
        color: var(--text);
      }

      .status-item.done strong { color: #c8ffdf; }
      .status-item.fail strong { color: var(--error); }
      .mono {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: Consolas, monospace;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="panel">
        <h1>Debug móvil Código Estelar</h1>
        <p>
          Esta página prueba el mismo flujo HTTP del juego sin recompilar la app.
          Si aquí funciona y la app falla, el sospechoso pasa a ser la build instalada.
        </p>
      </div>

      <div class="panel grid">
        <div>
          <label for="apiBaseUrl">Base URL de la API</label>
          <input id="apiBaseUrl" value="${escapeHtml(suggestedApiBaseUrl)}" />
        </div>
        <div>
          <label for="qrToken">QR del estudiante</label>
          <input id="qrToken" value="${escapeHtml(suggestedQrToken)}" placeholder="QR-XXXXXX-XXXXXX" />
        </div>
        <div>
          <label for="difficulty">Dificultad</label>
          <input id="difficulty" value="${escapeHtml(String(suggestedDifficulty))}" />
        </div>
        <div class="actions">
          <button type="button" onclick="runStep('health')">1. Probar health</button>
          <button type="button" onclick="runStep('minigames')">2. Probar minijuegos</button>
          <button type="button" onclick="runStep('login')">3. Probar login QR</button>
          <button type="button" onclick="runStep('session')">4. Probar sesion</button>
          <button type="button" onclick="runStep('socket')">5. Probar socket join</button>
          <button type="button" onclick="runFullFlow()">Correr flujo completo</button>
          <button type="button" class="secondary" onclick="resetLog()">Limpiar</button>
        </div>
      </div>

      <div class="panel">
        <h2>Lectura rápida</h2>
        <ul>
          <li>Si falla <strong>health</strong>, el navegador no ve el backend.</li>
          <li>Si pasa <strong>minijuegos</strong> pero falla <strong>login QR</strong>, el sospechoso es el POST desde ese dispositivo.</li>
          <li>Si pasa <strong>sesion HTTP</strong> pero falla <strong>socket join</strong>, el sospechoso pasa a ser realtime.</li>
          <li>Si todo pasa aquí y la app falla, el problema está en la build instalada, no en la API.</li>
        </ul>
      </div>

      <div class="panel">
        <h2>Resultado</h2>
        <div id="statusList" class="status-list"></div>
      </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const runtime = {
        studentToken: null,
        minigameId: null,
        sessionId: null,
        socketEvents: null,
      };

      const normalizeBaseUrl = (value) => value.trim().replace(/\\/+$/, '');
      const resolveSocketBaseUrl = (baseUrl) => {
        try {
          const url = new URL(baseUrl);
          return url.origin;
        } catch {
          return baseUrl;
        }
      };
      const statusList = document.getElementById('statusList');

      const appendStatus = (title, detail, kind = 'done') => {
        const item = document.createElement('div');
        item.className = 'status-item ' + kind;
        item.innerHTML = '<strong>' + title + '</strong><div class="mono"></div>';
        item.querySelector('.mono').textContent = detail;
        statusList.prepend(item);
      };

      const resetLog = () => {
        runtime.studentToken = null;
        runtime.minigameId = null;
        runtime.sessionId = null;
        runtime.socketEvents = null;
        statusList.innerHTML = '';
      };

      const getConfig = () => ({
        baseUrl: normalizeBaseUrl(document.getElementById('apiBaseUrl').value),
        qrToken: document.getElementById('qrToken').value.trim(),
        difficulty: Number(document.getElementById('difficulty').value) || 2,
      });

      const fetchJson = async (url, options = {}) => {
        const response = await fetch(url, options);
        const text = await response.text();
        let payload = null;

        try {
          payload = text ? JSON.parse(text) : null;
        } catch (error) {
          payload = { raw: text };
        }

        return {
          ok: response.ok,
          status: response.status,
          payload,
        };
      };

      const stepHealth = async () => {
        const { baseUrl } = getConfig();
        const result = await fetchJson(baseUrl + '/health');
        appendStatus('Health', JSON.stringify(result, null, 2), result.ok ? 'done' : 'fail');
        return result;
      };

      const stepMinigames = async () => {
        const { baseUrl } = getConfig();
        const result = await fetchJson(baseUrl + '/minijuegos');
        if (result.ok && result.payload?.success) {
          const minigame = result.payload.data.find((item) => item.slug === 'codigo-estelar');
          runtime.minigameId = minigame?.id ?? null;
        }
        appendStatus('Minijuegos', JSON.stringify(result, null, 2), result.ok ? 'done' : 'fail');
        return result;
      };

      const stepLogin = async () => {
        const { baseUrl, qrToken } = getConfig();
        const result = await fetchJson(baseUrl + '/estudiantes/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qr_token: qrToken }),
        });
        if (result.ok && result.payload?.success) {
          runtime.studentToken = result.payload.data.token;
        }
        appendStatus('Login QR', JSON.stringify(result, null, 2), result.ok ? 'done' : 'fail');
        return result;
      };

      const stepSession = async () => {
        const { baseUrl, difficulty } = getConfig();

        if (!runtime.studentToken) {
          await stepLogin();
        }

        if (!runtime.minigameId) {
          await stepMinigames();
        }

        const result = await fetchJson(baseUrl + '/sesiones/iniciar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + runtime.studentToken,
          },
          body: JSON.stringify({
            minijuego_id: runtime.minigameId,
            dificultad: difficulty,
          }),
        });
        if (result.ok && result.payload?.success) {
          runtime.sessionId = result.payload.data.sesion?.id ?? null;
          runtime.socketEvents = result.payload.data.realtime?.socket_events ?? null;
        }
        appendStatus('Sesion HTTP', JSON.stringify(result, null, 2), result.ok ? 'done' : 'fail');
        return result;
      };

      const stepSocket = async () => {
        const { baseUrl } = getConfig();

        if (!runtime.studentToken) {
          const loginResult = await stepLogin();
          if (!loginResult.ok) {
            return loginResult;
          }
        }

        if (!runtime.sessionId || !runtime.socketEvents) {
          const sessionResult = await stepSession();
          if (!sessionResult.ok) {
            return sessionResult;
          }
        }

        if (typeof io !== 'function') {
          const result = {
            ok: false,
            status: 0,
            payload: {
              success: false,
              message: 'No se pudo cargar el cliente Socket.IO en la pagina debug',
            },
          };
          appendStatus('Socket join', JSON.stringify(result, null, 2), 'fail');
          return result;
        }

        const socketBaseUrl = resolveSocketBaseUrl(baseUrl);
        const events = runtime.socketEvents;

        const result = await new Promise((resolve) => {
          const socket = io(socketBaseUrl, {
            auth: { token: runtime.studentToken },
            transports: ['polling', 'websocket'],
            timeout: 8000,
            reconnection: false,
          });

          let settled = false;

          const finish = (payload, kind = 'done') => {
            if (settled) return;
            settled = true;
            socket.disconnect();
            appendStatus('Socket join', JSON.stringify(payload, null, 2), kind);
            resolve(payload);
          };

          const timeoutId = setTimeout(() => {
            finish(
              {
                ok: false,
                status: 0,
                payload: {
                  success: false,
                  message: 'Timeout esperando connect/join de Socket.IO',
                },
              },
              'fail'
            );
          }, 10000);

          socket.on('connect', () => {
            socket.emit(events.join, { sesionId: runtime.sessionId });
          });

          socket.on(events.joined, (payload) => {
            clearTimeout(timeoutId);
            finish({
              ok: true,
              status: 200,
              payload: {
                success: true,
                transport: socket.io.engine?.transport?.name ?? 'desconocido',
                data: payload,
              },
            });
          });

          socket.on(events.error, (payload) => {
            clearTimeout(timeoutId);
            finish(
              {
                ok: false,
                status: 400,
                payload: {
                  success: false,
                  transport: socket.io.engine?.transport?.name ?? 'desconocido',
                  data: payload,
                },
              },
              'fail'
            );
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeoutId);
            finish(
              {
                ok: false,
                status: 0,
                payload: {
                  success: false,
                  message: error?.message ?? 'connect_error sin detalle',
                },
              },
              'fail'
            );
          });
        });

        return result;
      };

      const runStep = async (stepName) => {
        try {
          if (stepName === 'health') return await stepHealth();
          if (stepName === 'minigames') return await stepMinigames();
          if (stepName === 'login') return await stepLogin();
          if (stepName === 'session') return await stepSession();
          if (stepName === 'socket') return await stepSocket();
        } catch (error) {
          appendStatus(stepName, error.stack || error.message, 'fail');
        }
      };

      const runFullFlow = async () => {
        resetLog();
        await runStep('health');
        await runStep('minigames');
        await runStep('login');
        await runStep('session');
        await runStep('socket');
      };
    </script>
  </body>
</html>`;
