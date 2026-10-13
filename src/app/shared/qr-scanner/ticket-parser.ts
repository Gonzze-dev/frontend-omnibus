/**
 * Not every bus company generates the ticket QR with the same
 * format. Each parser knows how to recognize and extract the ticket number of
 * ONE particular format; it returns null if the text does not belong to it.
 *
 * `parseTicket` tries them in order until one recognizes the
 * content. If none does, the QR is not a valid bus ticket (or it is a
 * format that is not supported yet).
 */
export type TicketParser = (text: string) => string | null;

export class QrTicketError extends Error {}

export function parseTicket(parsers: TicketParser[], text: string): string {
  for (const parser of parsers) {
    const ticket = parser(text);
    if (ticket) return ticket;
  }

  throw new QrTicketError('No se pudo escanear el QR correctamente.');
}

/** "Nuevo Expreso" format: plain text with a "Boleto: <code>" line. */
export const ticketLabelParser: TicketParser = (text) => {
  const match = text.match(/boleto:\s*(\S+)/i);
  return match ? match[1] : null;
};

/** The QR only carries the ticket code, with no surrounding text. */
export const bareCodeParser: TicketParser = (text) => {
  const value = text.trim();
  return /^[A-Z]{2,5}-\d{4,}-\d+$/i.test(value) ? value : null;
};

export const TICKET_PARSERS: TicketParser[] = [ticketLabelParser, bareCodeParser];
