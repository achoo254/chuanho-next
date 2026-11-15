import { defineBrand } from '@achoo254/brand';
import { hostsFor } from '@achoo254/brand/hosts';
import brandConfig from '../../../brand.config.json';

/** The product's name, colours and hosts: read them from here, never hard-code them. */
export const brand = defineBrand(brandConfig);

/** The ecosystem's home page (the footer's "An app from …" link). */
export const ECOSYSTEM_URL = `https://${brand.primaryTenant.domain}`;

/** The app mark in the header (the placeholder icon until the AI-drawn mascot lands). */
export const BRAND_MARK_SRC = '/favicon.svg';

/** The web app's host (`chuanho.<domain>`), printed on the share card. */
export const WEB_HOST = hostsFor(brand, brand.primaryTenant.domain).web;
