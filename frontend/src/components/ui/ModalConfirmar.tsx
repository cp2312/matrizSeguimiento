import { Modal } from './Modal';
import { Boton } from './Boton';
import { Alerta } from './Alerta';

interface Props {
  abierto: boolean;
  titulo?: string;
  mensaje: React.ReactNode;
  textoConfirmar?: string;
  /** Texto del botón de confirmar mientras se ejecuta, p. ej. "Eliminando…" */
  textoEnviando?: string;
  variante?: 'primario' | 'peligro';
  enviando?: boolean;
  error?: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/**
 * Ventana de "¿estás seguro?" ANTES de ejecutar una acción -- a diferencia de
 * un simple cambio de texto junto al botón (fácil de no notar), esto abre un
 * modal de verdad, con su propio fondo oscurecido, igual al que ya se usa
 * para "Eliminar programa". Se usa tanto suelta (ver BotonConfirmar) como
 * apilada encima de otro modal (p. ej. el formulario de "Nuevo programa").
 */
export function ModalConfirmar({
  abierto, titulo = 'Confirmar', mensaje, textoConfirmar = 'Confirmar', textoEnviando,
  variante = 'primario', enviando = false, error, onCancelar, onConfirmar,
}: Props) {
  // Por defecto, el texto mientras se envía depende de qué tipo de acción es
  // (peligro = normalmente elimina algo).
  const textoMientrasEnvia = textoEnviando ?? (variante === 'peligro' ? 'Eliminando…' : 'Guardando…');

  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCancelar}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600">{mensaje}</div>

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCancelar}>Cancelar</Boton>
          <Boton type="button" variante={variante} onClick={onConfirmar} disabled={enviando}>
            {enviando ? textoMientrasEnvia : textoConfirmar}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
