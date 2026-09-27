/**
 * No todas las empresas de micros generan el QR del pasaje con el mismo
 * formato. Cada parser sabe reconocer y extraer el numero de boleto de
 * UN formato particular; devuelve null si el texto no le pertenece.
 *
 * `parsearBoleto` los prueba en orden hasta que alguno reconozca el
 * contenido. Si ninguno lo hace, el QR no es un pasaje valido (o es un
 * formato que todavia no se soporta).
 */
export type ParserBoleto = (texto: string) => string | null;

export class QrBoletoError extends Error {}

export function parsearBoleto(parsers: ParserBoleto[], texto: string): string {
  for (const parser of parsers) {
    const boleto = parser(texto);
    if (boleto) return boleto;
  }

  throw new QrBoletoError('No se pudo escanear el QR correctamente.');
}

/** Formato "Nuevo Expreso": texto plano con una linea "Boleto: <codigo>". */
export const parserEtiquetaBoleto: ParserBoleto = (texto) => {
  const match = texto.match(/boleto:\s*(\S+)/i);
  return match ? match[1] : null;
};

/** El QR trae unicamente el codigo del boleto, sin texto alrededor. */
export const parserCodigoSuelto: ParserBoleto = (texto) => {
  const valor = texto.trim();
  return /^[A-Z]{2,5}-\d{4,}-\d+$/i.test(valor) ? valor : null;
};

export const PARSERS_BOLETO: ParserBoleto[] = [parserEtiquetaBoleto, parserCodigoSuelto];
