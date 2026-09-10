import type { NewBomLine, NewItem, NewQuote, NewVendor } from './schema';

const SRC = '../AICamera/docs/SHOPPING.md';
const CAM = '../AICamera/docs/CAMERAS.md';
const CAR = '../AICamera/docs/CARRIER.md';
const POW = '../AICamera/docs/POWER.md';
const INT = '../AICamera/docs/INTERCONNECT.md';
const SEN = '../AICamera/docs/SENSORS.md';
const ENC = '../AICamera/docs/ENCLOSURE.md';
const CHECKED = '2026-09-01';

export const seedVendors: NewVendor[] = [
	{ id: 'arrow', name: 'Arrow', url: 'https://www.arrow.com', notes: 'T4000 SOM and AGX kit.' },
	{ id: 'nvidia', name: 'NVIDIA', url: 'https://www.nvidia.com', notes: 'List prices hiked Jul 2026.' },
	{ id: 'cti', name: 'Connect Tech', url: 'https://connecttech.com', email: 'sales@connecttech.com' },
	{ id: 'wdl', name: 'WDL Systems', url: 'https://www.wdlsystems.com', notes: 'US CTI reseller.' },
	{ id: 'forecr', name: 'FORECR', url: 'https://www.forecr.io', email: 'sales@forecr.io' },
	{ id: 'digikey', name: 'Digi-Key', url: 'https://www.digikey.com' },
	{ id: 'bh', name: 'B&H', url: 'https://www.bhphotovideo.com' },
	{ id: 'mouser', name: 'Mouser', url: 'https://www.mouser.com' },
	{ id: 'print', name: 'In-house print', notes: 'Anycubic resin. Not a vendor quote.' },
	{ id: 'tbd', name: 'TBD / quote', notes: 'Placeholder until a PO lands.' }
];

// `floor` is required here even though the column has a default: an untagged
// row is a silent `buy`, and the seed is the crib every explode reads from.
// `foundry` is reserved by the living spec and stays out of the seed.
type SeedItem = NewItem & { floor: 'buy' | 'assemble'; quote?: Omit<NewQuote, 'itemSku'> };

export const seedItems: SeedItem[] = [
	{
		sku: 't4000-som',
		name: 'NVIDIA Jetson T4000 SOM',
		kind: 'part',
		floor: 'buy',
		category: 'compute',
		status: 'preferred',
		manufacturer: 'NVIDIA',
		mpn: '900-13834-0000-000',
		description:
			'Production ceiling. 64 GB, 1× NVENC, 70 W default / 90 W throttle. No CAN, no 3.3 V SV.',
		source: CAR,
		massG: 350,
		widthMm: 87,
		heightMm: 100,
		depthMm: 15,
		wattsTypical: 70,
		wattsMax: 90,
		notes: 'Needs a 699-pin carrier + TTP cooler. Stay here unless sat count forces T5000.',
		quote: {
			vendorId: 'arrow',
			priceCents: 274900,
			currency: 'USD',
			url: 'https://www.arrow.com/en/products/900-13834-0000-000/nvidia',
			checkedAt: CHECKED,
			inStock: true,
			isPreferred: true,
			notes: 'Qty 1 street. 1KU list hiked to $2,999 Jul 2026.'
		}
	},
	{
		sku: 'agx-thor-devkit',
		name: 'NVIDIA AGX Thor Developer Kit',
		kind: 'part',
		floor: 'buy',
		category: 'compute',
		status: 'preferred',
		manufacturer: 'NVIDIA',
		mpn: '945-14070-0080-000',
		description:
			'Lab brick. T5000 module in NVIDIA’s enclosure. Fastest software bring-up. Not the production envelope.',
		source: CAR,
		widthMm: 243,
		heightMm: 112,
		depthMm: 57,
		wattsTypical: 80,
		wattsMax: 130,
		notes: 'T5000, 128 GB, 2× NVENC, 5GbE + QSFP28. No HDMI/SDI in. Resin shell wraps this.',
		quote: {
			vendorId: 'arrow',
			priceCents: 349900,
			currency: 'USD',
			checkedAt: CHECKED,
			inStock: true,
			isPreferred: true,
			notes: 'US kit PN. NVIDIA list hiked to $5,499 Jul 2026; treat Amazon as unverified.'
		}
	},
	{
		sku: 'rogue-t5',
		name: 'Connect Tech Rogue-T5',
		kind: 'part',
		floor: 'buy',
		category: 'carrier',
		status: 'preferred',
		manufacturer: 'Connect Tech',
		mpn: 'AGX302',
		description:
			'Preferred production carrier. T4000 and T5000. Camera I/O is add-on, not on the board.',
		source: SRC,
		massG: 136,
		widthMm: 92,
		heightMm: 108,
		notes: '2× 10GBASE-T + 1× 2.5G on locking IX. 12 V. Manual CTIM-00160. Quote sales@connecttech.com.',
		quote: {
			vendorId: 'cti',
			priceCents: null,
			currency: 'USD',
			isPreferred: true,
			notes: 'Carrier-only is quote. WDL T5000 assemblies $8,225–$12,325 — do not buy those to solder a SOM.'
		}
	},
	{
		sku: 'gauntlet-agx301',
		name: 'Connect Tech Gauntlet',
		kind: 'part',
		floor: 'buy',
		category: 'carrier',
		status: 'candidate',
		manufacturer: 'Connect Tech',
		mpn: 'AGX301',
		description: 'Bigger CTI carrier. Dual NVMe, RJ45 instead of IX plugs.',
		source: SRC,
		widthMm: 155,
		heightMm: 126,
		notes: 'AU listing ~US$2,600. Confirm carrier-only vs with T5000.',
		quote: {
			vendorId: 'cti',
			priceCents: 260000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'AU listing A$3,999 ballpark. Not preferred vs Rogue-T5.'
		}
	},
	{
		sku: 'forecr-thrmax',
		name: 'FORECR DSBOARD-THRMAX',
		kind: 'part',
		floor: 'buy',
		category: 'carrier',
		status: 'candidate',
		manufacturer: 'FORECR',
		mpn: 'DSBOARD-THRMAX',
		description: 'Cheapest T4000-capable carrier with a public price. HDMI is output, not capture.',
		source: SRC,
		widthMm: 140,
		heightMm: 125,
		notes: 'QSFP28 4×25G. Fallback if CTI quotes slowly. CAN-FD pins dead on T4000.',
		quote: {
			vendorId: 'forecr',
			priceCents: 110000,
			currency: 'USD',
			url: 'https://www.forecr.io/products/nvidia-jetson-thor-carrier-board-dsboard-thrmax',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: '€999 carrier-only. SOM/SSD variants listed sold out.'
		}
	},
	{
		sku: 'auvidea-x242',
		name: 'Auvidea X242',
		kind: 'part',
		floor: 'buy',
		category: 'carrier',
		status: 'do-not-buy',
		manufacturer: 'Auvidea',
		mpn: 'X242',
		description: 'Published as T5000. Do not assume T4000 until Auvidea says so.',
		source: SRC,
		notes: 'CSI-native, no SDI. Parked until T4000 is in writing.',
		quote: { vendorId: 'tbd', priceCents: null, currency: 'USD', notes: 'Quote. Do not buy yet.' }
	},
	{
		sku: 'ats-nvp-3739',
		name: 'ATS Thor passive heatsink',
		kind: 'part',
		floor: 'buy',
		category: 'thermal',
		status: 'preferred',
		manufacturer: 'ATS',
		mpn: 'ATS-NVP-3739',
		description: 'TTP cooler. 100 W rating is 500 LFM chassis air, not still air.',
		source: POW,
		massG: 168,
		widthMm: 87,
		heightMm: 101,
		depthMm: 20,
		notes: 'Measure on the bench. Production wants heatpipes to a radiator, not this brick as the product lid.',
		quote: {
			vendorId: 'digikey',
			priceCents: 5600,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '~$47–56 street. Passive.'
		}
	},
	{
		sku: 'ats-nva-3740',
		name: 'ATS Thor active heatsink',
		kind: 'part',
		floor: 'buy',
		category: 'thermal',
		status: 'candidate',
		manufacturer: 'ATS',
		mpn: 'ATS-NVA-3740',
		description: 'Fan in the fins. 95 W @ 50 °C. Prefer measuring the passive first.',
		source: POW,
		massG: 104,
		widthMm: 87,
		heightMm: 101,
		depthMm: 20,
		quote: {
			vendorId: 'digikey',
			priceCents: 12500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: '~$106–125 street.'
		}
	},
	{
		sku: 'cti-msg103',
		name: 'CTI MSG103 252 W brick',
		kind: 'part',
		floor: 'buy',
		category: 'power',
		status: 'preferred',
		manufacturer: 'Connect Tech',
		mpn: 'MSG103',
		description: '12 V brick for Rogue-T5.',
		source: SRC,
		wattsMax: 252,
		quote: { vendorId: 'cti', priceCents: null, currency: 'USD', isPreferred: true, notes: 'Quote with the carrier.' }
	},
	{
		sku: 'cti-jcb003',
		name: 'CTI JCB003 SDI→CSI',
		kind: 'part',
		floor: 'buy',
		category: 'interconnect',
		status: 'do-not-buy',
		manufacturer: 'Connect Tech',
		mpn: 'JCB003',
		description: '2× 3G-SDI in → MIPI. 1080p60 max. Not a 4K pipeline.',
		source: SRC,
		notes: 'PYXIS 12G-SDI will not give 4K through this. Only if we accept 1080p into the ISP on day one.',
		quote: {
			vendorId: 'wdl',
			priceCents: 153800,
			currency: 'USD',
			url: 'https://www.wdlsystems.com/connect-tech-jcb003-01',
			checkedAt: CHECKED,
			inStock: true,
			isPreferred: false,
			notes: 'Do not buy as a 4K path.'
		}
	},
	{
		sku: 'cti-jcb010',
		name: 'CTI JCB010 HDMI→CSI',
		kind: 'part',
		floor: 'buy',
		category: 'interconnect',
		status: 'candidate',
		manufacturer: 'Connect Tech',
		mpn: 'JCB010',
		description: '4× HDMI → MIPI. 4K30 maybe. Thor BSP not confirmed in public docs.',
		source: SRC,
		quote: { vendorId: 'cti', priceCents: null, currency: 'USD', notes: 'Page still says Rogue/Forge Orin/Xavier.' }
	},
	{
		sku: 'cti-jcb022',
		name: 'CTI JCB022 GMSL2 deserializer',
		kind: 'part',
		floor: 'buy',
		category: 'interconnect',
		status: 'candidate',
		manufacturer: 'Connect Tech',
		mpn: 'JCB022',
		description: '8-ch GMSL2, PoC. Honest 4K30 RAW count is 4 at 4-lane.',
		source: CAM,
		widthMm: 75,
		heightMm: 57,
		massG: 45,
		notes: 'Add later if a sat needs to become a RAW tracker. Bring-up sats are PoE H.265.',
		quote: { vendorId: 'cti', priceCents: null, currency: 'USD', notes: 'Quote. Mates Rogue-T5 / Gauntlet camera header.' }
	},
	{
		sku: 'pyxis-6k-pl',
		name: 'Blackmagic PYXIS 6K PL',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'preferred',
		manufacturer: 'Blackmagic Design',
		description:
			'Cine A-cam. Cooke /i pins at 12 o’clock. BRAW internally. Not a CSI camera — path B.',
		source: SRC,
		widthMm: 119,
		heightMm: 106,
		depthMm: 151,
		massG: 1500,
		wattsTypical: 20,
		notes: 'Best match to LENS.md. SDI is 4K60 monitoring, not a Thor CSI input. Mount is not user-swappable.',
		quote: {
			vendorId: 'bh',
			priceCents: 367500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: 'Street 2026-09-01. Do not buy EF “and add /i later”.'
		}
	},
	{
		sku: 'pyxis-6k-ef',
		name: 'Blackmagic PYXIS 6K EF',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Blackmagic Design',
		description: 'Active EF metadata, not /i. Cheaper glass. Same SDI/Ethernet box.',
		source: SRC,
		massG: 1500,
		quote: {
			vendorId: 'bh',
			priceCents: 345500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Not the hero. /i lives on PL only.'
		}
	},
	{
		sku: 'pyxis-12k',
		name: 'Blackmagic PYXIS 12K',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'do-not-buy',
		manufacturer: 'Blackmagic Design',
		description: 'Overkill. Early 12K had a sensor-board recall. 10GbE we do not need.',
		source: SRC,
		quote: {
			vendorId: 'bh',
			priceCents: 582500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Do not buy yet.'
		}
	},
	{
		sku: 'pocket-6k-g2',
		name: 'Blackmagic Pocket 6K G2',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Blackmagic Design',
		description: 'HDMI mule + EF metadata. Lab Cart S, not the product body.',
		source: SRC,
		quote: {
			vendorId: 'bh',
			priceCents: 226900,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: 'Used ~$1,770. Fine as sacrificial HDMI source.'
		}
	},
	{
		sku: 'pocket-6k-pro',
		name: 'Blackmagic Pocket 6K Pro',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Blackmagic Design',
		description: 'Same as G2 plus ND/XLR. Still HDMI only.',
		source: SRC,
		quote: {
			vendorId: 'bh',
			priceCents: 283500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false
		}
	},
	{
		sku: 'cinema-6k-l',
		name: 'Blackmagic Cinema Camera 6K L',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Blackmagic Design',
		description: 'Cheapest full-frame 6K. HDMI. Worse bolted-to-Thor than PYXIS.',
		source: SRC,
		quote: {
			vendorId: 'bh',
			priceCents: 298900,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Used ~$2,390.'
		}
	},
	{
		sku: 'arducam-imx678',
		name: 'Arducam xISP IMX678',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Arducam',
		description: 'Cheap 4K CSI for Orin NX. Confirm Thor device tree. M12, no /i.',
		source: CAM,
		quote: {
			vendorId: 'tbd',
			priceCents: 16000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Do not assume it just works on JetPack 7.'
		}
	},
	{
		sku: 'vc-imx585',
		name: 'Vision Components VC MIPI IMX585',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Vision Components',
		description: 'Starvis 1/1.2" 4K CSI module. Optional GMSL2 adapter (~10 m).',
		source: CAM,
		notes: 'Closest cheap “real module” for a CSI body on the box.',
		quote: {
			vendorId: 'tbd',
			priceCents: 27000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: '~€245 1ku flyer; proto higher.'
		}
	},
	{
		sku: 'framos-imx900-csi',
		name: 'FRAMOS FSM:GO IMX900 CSI',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'FRAMOS',
		description: '3.2 MP global shutter. Thor “preparing” Aug 2026. Not 4K.',
		source: CAM,
		quote: {
			vendorId: 'mouser',
			priceCents: 12900,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false
		}
	},
	{
		sku: 'nilecam81',
		name: 'e-con NileCAM81',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'e-con Systems',
		description: 'IMX678 4K GMSL2. Orin-era. Thor BSP unknown.',
		source: CAM,
		quote: {
			vendorId: 'tbd',
			priceCents: 9900,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false
		}
	},
	{
		sku: 'alvium-csi2',
		name: 'Allied Vision Alvium CSI-2',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Allied Vision',
		description: 'C-mount, many sensors. Closest catalog “cine CSI”. JetPack 6.2 / Orin drivers.',
		source: CAM,
		quote: {
			vendorId: 'tbd',
			priceCents: 80000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Street $400–1,500. Mid used for roll-up.'
		}
	},
	{
		sku: 'alvium-gm2',
		name: 'Allied Vision Alvium GM2',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Allied Vision',
		description: 'C-mount + GMSL2 + FAKRA. Best sat-with-real-glass if we go RAW.',
		source: CAM,
		quote: {
			vendorId: 'tbd',
			priceCents: 100000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: false,
			notes: 'Street $500–2,000. Mid used for roll-up.'
		}
	},
	{
		sku: 'leopard-p3762',
		name: 'NVIDIA / Leopard P3762 kit camera',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'candidate',
		manufacturer: 'Leopard Imaging',
		mpn: 'P3762',
		description: 'Dev-kit ribbon. Not 4K cine. Fine until a CSI module is picked.',
		source: CAM,
		quote: { vendorId: 'tbd', priceCents: null, currency: 'USD', notes: 'Kit accessory.' }
	},
	{
		sku: 'rv1126b-turret',
		name: 'RV1126/B IMX415 PoE turret',
		kind: 'part',
		floor: 'buy',
		category: 'camera',
		status: 'preferred',
		manufacturer: 'various',
		description:
			'Encode mule. PoE + IMX415 + H.265 + ONVIF already work. Crack, keep the PCB, bin the shell.',
		source: CAM,
		wattsTypical: 8,
		wattsMax: 15,
		notes: 'Not the product sat. First RTSP packet this week.',
		quote: {
			vendorId: 'tbd',
			priceCents: 10000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '$50–150 street. Mid $100.'
		}
	},
	{
		sku: 'rv1126b-evb',
		name: 'RV1126B EVB + IMX415',
		kind: 'part',
		floor: 'buy',
		category: 'compute',
		status: 'preferred',
		manufacturer: 'Fanconn / Boardcon / EASY-EAI',
		description: 'Sat software home. SDK, UART, Ethernet. Prefer B silicon.',
		source: CAM,
		notes: 'UART for /i and 1D ToF. This is why we own the board.',
		quote: {
			vendorId: 'tbd',
			priceCents: 20000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '$160–244 street. Mid $200.'
		}
	},
	{
		sku: 'rv1126b-core',
		name: 'RV1126B 38 mm core',
		kind: 'part',
		floor: 'buy',
		category: 'compute',
		status: 'preferred',
		manufacturer: 'Fanconn / Boardcon',
		description: 'Path to the C-mount sat we ship. MIPI CSI, GbE on newer B modules.',
		source: CAM,
		quote: {
			vendorId: 'tbd',
			priceCents: 11000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '$90–135 1-off. Mid $110.'
		}
	},
	{
		sku: 'tfmini-s',
		name: 'Benewake TFmini-S',
		kind: 'part',
		floor: 'buy',
		category: 'lidar',
		status: 'preferred',
		manufacturer: 'Benewake',
		mpn: 'TFmini-S',
		description: '1D ToF. Subject distance 0.1–12 m, UART, ~0.7 W. On every picture sat.',
		source: CAM,
		massG: 25,
		wattsTypical: 1,
		notes: 'Needs the module UART, not a sealed turret. JSONL sidecar next to /i.',
		quote: {
			vendorId: 'tbd',
			priceCents: 3500,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '$25–45. TF-Luna is the cheaper cousin.'
		}
	},
	{
		sku: 'livox-mid360s',
		name: 'Livox Mid-360S',
		kind: 'part',
		floor: 'buy',
		category: 'lidar',
		status: 'preferred',
		manufacturer: 'Livox',
		mpn: 'Mid-360S',
		description: 'One 3D lidar on the rig, Ethernet peer on the PoE switch. Not per camera.',
		source: CAM,
		massG: 265,
		widthMm: 65,
		heightMm: 65,
		depthMm: 60,
		notes: '905 nm Class 1 — still a laser on a film set; flag it. 265 g / $550 does not go on every eyeball.',
		quote: {
			vendorId: 'tbd',
			priceCents: 55000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true
		}
	},
	{
		sku: 'poe-switch-at',
		name: 'PoE+ GbE switch',
		kind: 'part',
		floor: 'buy',
		category: 'network',
		status: 'placeholder',
		description: 'Kit item. Thor has no PoE. Two PoE+ sats ≈ 60 W at the PSE. Do not power Thor from this.',
		source: INT,
		wattsTypical: 20,
		wattsMax: 90,
		notes: 'Exact SKU still open (at vs bt). Own PSU.',
		quote: {
			vendorId: 'tbd',
			priceCents: 20000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: 'Placeholder $200 until a SKU is picked.'
		}
	},
	{
		sku: 'hdmi-usb-capture',
		name: 'USB HDMI capture',
		kind: 'part',
		floor: 'buy',
		category: 'interconnect',
		status: 'candidate',
		description: 'UVC into Thor USB. Fine for AD, not for the take.',
		source: SRC,
		quote: {
			vendorId: 'tbd',
			priceCents: 8000,
			currency: 'USD',
			checkedAt: CHECKED,
			isPreferred: true,
			notes: '$30–200. Mid $80.'
		}
	},
	{
		sku: 'hdmi-cable',
		name: 'HDMI cable',
		kind: 'part',
		floor: 'buy',
		category: 'accessory',
		status: 'placeholder',
		description: 'Pocket / PYXIS monitor feed into Thor or a capture dongle.',
		source: SRC,
		quote: { vendorId: 'tbd', priceCents: 1500, currency: 'USD', checkedAt: CHECKED, isPreferred: true }
	},
	{
		sku: 'nvme-1tb',
		name: '1 TB NVMe',
		kind: 'part',
		floor: 'buy',
		category: 'storage',
		status: 'placeholder',
		description: 'Ring buffer on the carrier. AGX kit already ships one.',
		source: CAR,
		quote: { vendorId: 'tbd', priceCents: 8000, currency: 'USD', checkedAt: CHECKED, isPreferred: true }
	},
	{
		sku: 'resin-shell-front',
		name: 'AGX kit resin shell — front',
		kind: 'part',
		floor: 'buy',
		category: 'enclosure',
		status: 'placeholder',
		description: 'Fit-check of the lab brick. Resin is not a heat sink.',
		source: ENC,
		quote: { vendorId: 'print', priceCents: 0, currency: 'USD', isPreferred: true, notes: 'Printed. STL in AICamera/docs/cad.' }
	},
	{
		sku: 'resin-shell-rear',
		name: 'AGX kit resin shell — rear',
		kind: 'part',
		floor: 'buy',
		category: 'enclosure',
		status: 'placeholder',
		description: 'Two-part Anycubic bed. Vents the kit fan / TTP.',
		source: ENC,
		quote: { vendorId: 'print', priceCents: 0, currency: 'USD', isPreferred: true, notes: 'Printed.' }
	},
	{
		sku: 'pl-i-reader',
		name: 'PL /i reader',
		kind: 'part',
		floor: 'buy',
		category: 'lens',
		status: 'placeholder',
		description: 'Four PL pins, RS-232-ish, milliamps. Not servo power. Sidecar UART into Thor.',
		source: '../AICamera/docs/LENS.md',
		notes: 'No catalog SKU yet. Steal the mount PCB off a PYXIS PL if we crack one — not the sensor.',
		quote: { vendorId: 'tbd', priceCents: null, currency: 'USD', notes: 'Placeholder. Build or harvest.' }
	},
	{
		sku: 'ix-industrial-breakout',
		name: 'IX Industrial to RJ45 breakout',
		kind: 'part',
		floor: 'buy',
		category: 'network',
		status: 'placeholder',
		description: 'Rogue-T5 uses locking IX plugs. Need cables to talk to a normal switch.',
		source: SRC,
		quote: { vendorId: 'cti', priceCents: null, currency: 'USD', notes: 'Quote with the carrier.' }
	},
	{
		sku: 'fakra-cable-10m',
		name: 'FAKRA coax 10 m',
		kind: 'part',
		floor: 'buy',
		category: 'interconnect',
		status: 'candidate',
		description: 'GMSL2 plant. 8–15 m class. Not 100 m.',
		source: CAM,
		quote: { vendorId: 'tbd', priceCents: 4000, currency: 'USD', checkedAt: CHECKED, isPreferred: false }
	},
	{
		sku: 'v-mount-plate',
		name: 'V-mount battery plate',
		kind: 'part',
		floor: 'buy',
		category: 'power',
		status: 'placeholder',
		description: 'Production body back. Remote radiator can live here.',
		source: POW,
		quote: { vendorId: 'tbd', priceCents: 8000, currency: 'USD', checkedAt: CHECKED, isPreferred: true }
	},
	{
		sku: 'asm-lab-shell',
		name: 'Lab resin shell',
		kind: 'assembly',
		floor: 'assemble',
		category: 'enclosure',
		status: 'preferred',
		description: 'Two-part wrap of the AGX kit. First article, not the product body.',
		source: ENC
	},
	{
		sku: 'asm-thor-sandwich',
		name: 'T4000 + Rogue-T5 + cooler',
		kind: 'assembly',
		floor: 'assemble',
		category: 'compute',
		status: 'preferred',
		description: 'Smallest catalog production stack. ~92 × 108 × 40–55 mm, ~0.7–1.0 kg before battery and lens.',
		source: CAM,
		widthMm: 92,
		heightMm: 108,
		depthMm: 55,
		wattsTypical: 70,
		wattsMax: 90
	},
	{
		sku: 'asm-sat-mule',
		name: 'Sat encode mule',
		kind: 'assembly',
		floor: 'assemble',
		category: 'camera',
		status: 'preferred',
		description: 'A cracked turret. Known-good PoE H.265 this week. Not what we ship.',
		source: CAM
	},
	{
		sku: 'asm-sat-product',
		name: 'Sat module (product)',
		kind: 'assembly',
		floor: 'assemble',
		category: 'camera',
		status: 'preferred',
		description: 'RV1126B core in our case, UART ToF + /i. The sat we ship.',
		source: SEN,
		wattsTypical: 8
	},
	{
		sku: 'kit-lab',
		name: 'Cart S — lab brick',
		kind: 'kit',
		floor: 'assemble',
		category: 'kit',
		status: 'preferred',
		description: 'Software this week. AGX kit + HDMI mule. Matches the resin shell. Not production T4000.',
		source: SRC,
		notes: '~$5.8k as of 2026-09-01 before the shell print.'
	},
	{
		sku: 'kit-prod',
		name: 'Cart T — T4000 + Rogue-T5',
		kind: 'kit',
		floor: 'assemble',
		category: 'kit',
		status: 'preferred',
		description: 'Preferred production stack. Live AI is HDMI/USB until a CSI/GMSL add-on. Master is BRAW + /i on PYXIS.',
		source: SRC
	},
	{
		sku: 'kit-cine',
		name: 'Cart C — cine /i body',
		kind: 'kit',
		floor: 'assemble',
		category: 'kit',
		status: 'preferred',
		description: 'Same as Cart T. PYXIS 6K PL is non-negotiable. Do not swap EF.',
		source: SRC
	},
	{
		sku: 'kit-hybrid-plant',
		name: 'Hybrid plant — 1 body + 2 sats',
		kind: 'kit',
		floor: 'assemble',
		category: 'kit',
		status: 'preferred',
		description:
			'Body CSI into Thor NVENC. Sats PoE H.265. /i sidecar. PoE switch is a kit item. NAS is off-body.',
		source: INT
	}
];

type SeedBom = Pick<NewBomLine, 'parentSku' | 'childSku' | 'qty' | 'role' | 'notes' | 'optional' | 'sortOrder'>;

export const seedBoms: SeedBom[] = [
	{ parentSku: 'asm-lab-shell', childSku: 'resin-shell-front', qty: 1, role: 'front', sortOrder: 10 },
	{ parentSku: 'asm-lab-shell', childSku: 'resin-shell-rear', qty: 1, role: 'rear', sortOrder: 20 },

	{ parentSku: 'asm-thor-sandwich', childSku: 't4000-som', qty: 1, role: 'som', sortOrder: 10 },
	{ parentSku: 'asm-thor-sandwich', childSku: 'rogue-t5', qty: 1, role: 'carrier', sortOrder: 20 },
	{ parentSku: 'asm-thor-sandwich', childSku: 'ats-nvp-3739', qty: 1, role: 'ttp-cooler', sortOrder: 30 },
	{ parentSku: 'asm-thor-sandwich', childSku: 'nvme-1tb', qty: 1, role: 'ring', sortOrder: 40 },
	{ parentSku: 'asm-thor-sandwich', childSku: 'cti-msg103', qty: 1, role: 'psu', sortOrder: 50 },
	{
		parentSku: 'asm-thor-sandwich',
		childSku: 'ix-industrial-breakout',
		qty: 2,
		role: 'net',
		sortOrder: 60,
		notes: 'IX to something a switch understands.'
	},

	{ parentSku: 'asm-sat-mule', childSku: 'rv1126b-turret', qty: 1, role: 'eyeball', sortOrder: 10 },

	{ parentSku: 'asm-sat-product', childSku: 'rv1126b-core', qty: 1, role: 'soc', sortOrder: 10 },
	{
		parentSku: 'asm-sat-product',
		childSku: 'tfmini-s',
		qty: 1,
		role: 'range',
		sortOrder: 20,
		notes: 'UART sidecar. Needs pins a sealed turret will not give us.'
	},

	{ parentSku: 'kit-lab', childSku: 'agx-thor-devkit', qty: 1, role: 'brick', sortOrder: 10 },
	{ parentSku: 'kit-lab', childSku: 'asm-lab-shell', qty: 1, role: 'shell', sortOrder: 20 },
	{ parentSku: 'kit-lab', childSku: 'pocket-6k-g2', qty: 1, role: 'hdmi-mule', sortOrder: 30 },
	{ parentSku: 'kit-lab', childSku: 'hdmi-cable', qty: 1, role: 'feed', sortOrder: 40 },
	{
		parentSku: 'kit-lab',
		childSku: 'hdmi-usb-capture',
		qty: 1,
		role: 'ingest',
		optional: true,
		sortOrder: 50,
		notes: 'If the kit USB stack is easier than CSI.'
	},

	{ parentSku: 'kit-prod', childSku: 'asm-thor-sandwich', qty: 1, role: 'body-compute', sortOrder: 10 },
	{
		parentSku: 'kit-prod',
		childSku: 'pyxis-6k-pl',
		qty: 1,
		role: 'cine-body',
		sortOrder: 20,
		notes: 'Hero /i + BRAW. Not the CSI body.'
	},
	{
		parentSku: 'kit-prod',
		childSku: 'asm-sat-mule',
		qty: 2,
		role: 'sat-mule',
		sortOrder: 30,
		notes: 'Encode mules this week.'
	},
	{ parentSku: 'kit-prod', childSku: 'rv1126b-evb', qty: 1, role: 'sat-sdk', sortOrder: 40 },
	{ parentSku: 'kit-prod', childSku: 'poe-switch-at', qty: 1, role: 'plant', sortOrder: 50 },
	{
		parentSku: 'kit-prod',
		childSku: 'hdmi-usb-capture',
		qty: 1,
		role: 'live-ai',
		optional: true,
		sortOrder: 60,
		notes: 'Until a CSI/GMSL add-on exists.'
	},
	{
		parentSku: 'kit-prod',
		childSku: 'cti-jcb003',
		qty: 1,
		role: 'sdi-csi',
		optional: true,
		sortOrder: 70,
		notes: 'Only if we need SDI→CSI on day one. Accept 1080p.'
	},

	{ parentSku: 'kit-cine', childSku: 'asm-thor-sandwich', qty: 1, role: 'body-compute', sortOrder: 10 },
	{
		parentSku: 'kit-cine',
		childSku: 'pyxis-6k-pl',
		qty: 1,
		role: 'cine-body',
		sortOrder: 20,
		notes: 'Non-negotiable. Mount is not swappable.'
	},
	{ parentSku: 'kit-cine', childSku: 'asm-sat-mule', qty: 2, role: 'sat-mule', sortOrder: 30 },
	{ parentSku: 'kit-cine', childSku: 'rv1126b-evb', qty: 1, role: 'sat-sdk', sortOrder: 40 },
	{ parentSku: 'kit-cine', childSku: 'poe-switch-at', qty: 1, role: 'plant', sortOrder: 50 },

	{ parentSku: 'kit-hybrid-plant', childSku: 'asm-thor-sandwich', qty: 1, role: 'body', sortOrder: 10 },
	{ parentSku: 'kit-hybrid-plant', childSku: 'pl-i-reader', qty: 1, role: 'body-i', sortOrder: 20 },
	{
		parentSku: 'kit-hybrid-plant',
		childSku: 'vc-imx585',
		qty: 1,
		role: 'body-csi',
		optional: true,
		sortOrder: 30,
		notes: 'Native CSI body on the box. Placeholder until datasheets land.'
	},
	{ parentSku: 'kit-hybrid-plant', childSku: 'asm-sat-product', qty: 2, role: 'sat', sortOrder: 40 },
	{ parentSku: 'kit-hybrid-plant', childSku: 'poe-switch-at', qty: 1, role: 'plant', sortOrder: 50 },
	{
		parentSku: 'kit-hybrid-plant',
		childSku: 'livox-mid360s',
		qty: 1,
		role: 'rig-lidar',
		sortOrder: 60,
		notes: 'One on the rig, Ethernet peer. Not per eyeball.'
	},
	{ parentSku: 'kit-hybrid-plant', childSku: 'v-mount-plate', qty: 1, role: 'battery', sortOrder: 70 }
];
