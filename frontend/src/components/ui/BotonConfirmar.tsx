import { useState } from 'react';
import { Boton } from './Boton';
import { ModalConfirmar } from './ModalConfirmar';

interface Props {
  /** Acción real, solo se ejecuta tras confirmar en el modal */
  onConfirmar: () => void | Promise<void>;
  /** Corre antes de abrir el modal (p. ej. validar campos); si devuelve
   *  false, no se abre -- deja que el llamador muestre su propio error */
  onValidar?: () => boolean;
  /** Texto normal del botón, antes de pedir confirmación (p. ej. "Guardar") */
  etiqueta: React.ReactNode;
  /** Texto del botón de confirmar dentro del modal (p. ej. "Sí, guardar") */
  etiquetaConfirmar?: string;
  /** Título del modal de confirmación */
  titulo?: string;
  /** Pregunta que se muestra en el modal, p. ej. "¿Confirmás guardar estos cambios?" */
  mensaje: React.ReactNode;
  variante?: 'primario' | 'peligro';
  className?: string;
  disabled?: boolean;
}

/**
 * Botón que, en vez de ejecutar la acción de una vez, abre un modal real de
 * "¿estás seguro?" (ver ModalConfirmar) -- solo confirmar ahí ejecuta
 * `onConfirmar`. Pensado para reemplazar botones de guardar/quitar que antes
 * actuaban en un solo clic.
 */
export function BotonConfirmar({
  onConfirmar, onValidar, etiqueta, etiquetaConfirmar = 'Confirmar', titulo = 'Confirmar',
  mensaje, variante = 'primario', className = '', disabled,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  return (
    <>
      <Boton
        type="button"
        variante={variante}
        disabled={disabled}
        className={className}
        onClick={() => {
          if (onValidar && !onValidar()) return;
          setError('');
          setConfirmando(true);
        }}
      >
        {etiqueta}
      </Boton>

      <ModalConfirmar
        abierto={confirmando}
        titulo={titulo}
        mensaje={mensaje}
        textoConfirmar={etiquetaConfirmar}
        variante={variante}
        enviando={enviando}
        error={error}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={async () => {
          setEnviando(true);
          setError('');
          try {
            await onConfirmar();
            setConfirmando(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error, intenta de nuevo');
          } finally {
            setEnviando(false);
          }
        }}
      />
    </>
  );
}
