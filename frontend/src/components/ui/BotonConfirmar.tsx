import { useState } from 'react';
import { Boton } from './Boton';

interface Props {
  /** Acción real, solo se ejecuta tras el segundo clic (el de "sí, continuar") */
  onConfirmar: () => void | Promise<void>;
  /** Corre antes de mostrar la confirmación (p. ej. validar campos); si devuelve
   *  false, no se muestra el paso de "¿estás seguro?" -- deja que el llamador
   *  muestre su propio error */
  onValidar?: () => boolean;
  /** Texto normal del botón, antes de pedir confirmación (p. ej. "Guardar") */
  etiqueta: React.ReactNode;
  /** Texto del botón una vez confirmando (p. ej. "Sí, guardar") */
  etiquetaConfirmar?: string;
  /** Pregunta que se muestra al lado, p. ej. "¿Confirmás guardar estos cambios?" */
  mensaje: string;
  variante?: 'primario' | 'peligro' | 'secundario';
  className?: string;
  disabled?: boolean;
  /** Avisa al contenedor cuando se arma/desarma la confirmación, para que pueda
   *  ocultar otros botones "Cancelar" propios y no tener dos a la vez en pantalla */
  onConfirmandoChange?: (confirmando: boolean) => void;
}

/**
 * Botón que, al primer clic, se convierte en una franja "¿estás seguro?" con
 * Cancelar / Confirmar en vez de ejecutar la acción de una vez. Solo el
 * segundo clic (sobre "Sí, ...") llama a `onConfirmar`. Pensado para
 * reemplazar botones de guardar/quitar que antes actuaban en un solo clic.
 */
export function BotonConfirmar({
  onConfirmar, onValidar, etiqueta, etiquetaConfirmar = 'Confirmar',
  mensaje, variante = 'primario', className = '', disabled, onConfirmandoChange,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function cambiarConfirmando(valor: boolean) {
    setConfirmando(valor);
    onConfirmandoChange?.(valor);
  }

  if (!confirmando) {
    return (
      <Boton
        type="button"
        variante={variante}
        disabled={disabled}
        className={className}
        onClick={() => {
          if (onValidar && !onValidar()) return;
          cambiarConfirmando(true);
        }}
      >
        {etiqueta}
      </Boton>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap justify-end">
      <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{mensaje}</span>
      <button
        type="button"
        onClick={() => cambiarConfirmando(false)}
        className="text-[11.5px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 underline underline-offset-2"
      >
        Cancelar
      </button>
      <Boton
        type="button"
        variante={variante}
        disabled={enviando}
        className={`h-7 px-2.5 text-[11.5px] ${className}`}
        onClick={async () => {
          setEnviando(true);
          await onConfirmar();
          setEnviando(false);
          cambiarConfirmando(false);
        }}
      >
        {enviando ? 'Guardando…' : etiquetaConfirmar}
      </Boton>
    </span>
  );
}
