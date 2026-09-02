export function money(cents: number | null | undefined, currency = 'USD') {
	if (cents == null) return 'quote';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function mm(n: number | null | undefined) {
	if (n == null) return '—';
	return `${n} mm`;
}

export function grams(n: number | null | undefined) {
	if (n == null) return '—';
	if (n >= 1000) return `${(n / 1000).toFixed(2)} kg`;
	return `${n} g`;
}

export function watts(n: number | null | undefined) {
	if (n == null) return '—';
	return `${n} W`;
}
