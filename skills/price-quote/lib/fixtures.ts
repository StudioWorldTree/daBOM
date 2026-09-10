/**
 * Vendor response fixtures. These are the shapes the three day-one APIs
 * answer, trimmed to the fields the ladder reads: a manufacturer part
 * number, price breaks, a URL, and stock. Tests mock at the fetch boundary,
 * so no test in this skill ever calls a distributor.
 */

/** Arrow ERP item search, `resources[]=pricing`. */
export function arrowResponse(mpn: string, unitPrice = '2999.0000'): unknown {
	return {
		itemserviceresult: {
			data: [
				{
					PartList: [
						{
							itemId: '12345678',
							partNum: mpn,
							manufacturer: { mfrName: 'NVIDIA' },
							invOrg: [
								{
									webSites: [
										{
											sourcingOptions: [
												{
													buyUrl: `https://www.arrow.com/en/products/${mpn}/nvidia`,
													fohQuantity: '12',
													pricing: [
														{ minQty: 1, resalePrice: unitPrice, currency: 'USD' },
														{ minQty: 10, resalePrice: '2799.0000', currency: 'USD' }
													]
												}
											]
										}
									]
								}
							]
						}
					]
				}
			]
		}
	};
}

/** Digi-Key products v4 keyword search. */
export function digikeyResponse(mpn: string): unknown {
	return {
		Products: [
			{
				ManufacturerProductNumber: mpn,
				ProductUrl: `https://www.digikey.com/en/products/detail/${mpn}`,
				QuantityAvailable: 3,
				ProductVariations: [
					{
						DigiKeyProductNumber: '1234-ND',
						StandardPricing: [
							{ BreakQuantity: 1, UnitPrice: 3149.0, Currency: 'USD' },
							{ BreakQuantity: 5, UnitPrice: 2999.0, Currency: 'USD' }
						]
					}
				]
			}
		]
	};
}

/** Mouser part-number search. Prices arrive as formatted strings. */
export function mouserResponse(mpn: string): unknown {
	return {
		SearchResults: {
			NumberOfResult: 1,
			Parts: [
				{
					ManufacturerPartNumber: mpn,
					ProductDetailUrl: `https://www.mouser.com/ProductDetail/${mpn}`,
					Availability: '4 In Stock',
					PriceBreaks: [
						{ Quantity: 1, Price: '$3,199.00', Currency: 'USD' },
						{ Quantity: 25, Price: '$2,950.00', Currency: 'USD' }
					]
				}
			]
		}
	};
}

/** A distributor page that will not price a part without a sign-in. */
export const LOGIN_WALL_PAGE = `# Rogue-T5 Carrier Board

| Part | AGX302 |

**Sign in to see price** and availability for your account.

Add to cart to see price.
`;

/** A public product page that prices the part. */
export const PRICED_PAGE = `# NVIDIA Jetson T4000 SOM

Our price: $2,999.00 each

In stock, ships today.
`;
