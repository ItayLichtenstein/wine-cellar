/** "בקבוק אחד" / "3 בקבוקים": Hebrew counts read wrong as "1 בקבוקים". */
export function bottles(n: number): string {
  return n === 1 ? "בקבוק אחד" : `${n} בקבוקים`;
}
