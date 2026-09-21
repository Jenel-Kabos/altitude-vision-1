// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT-3B.
//
// Certifie que le service frontend consomme les surfaces backend typées :
//   /api/contrats/location/*
//   /api/contrats/vente/*
// et que la dispatch par ressource (`contrat.type`) est robuste face à un
// payload manipulé (§3/§8 : le body ne peut pas basculer l'autorité HTTP).
//
// Les tests montent en mock l'axios client (`../services/api`) et assèrent
// l'URL exacte, la méthode HTTP et le fait qu'aucun caller ne réintroduise
// la surface polymorphique legacy pour une mutation.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return { default: api, __esModule: true };
});

import api from '../services/api';
import {
  getRentalContracts, getSaleContracts,
  updateRentalContract, updateSaleContract,
  deleteRentalContract, deleteSaleContract,
  getRentalContractPayments,
  updateContratByResource, deleteContratByResource,
  getContrats, createContrat,
} from '../services/gestionLocativeService';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  api.get.mockResolvedValue({ data: { data: { contrats: [], paiements: [], contrat: {} } } });
  api.post.mockResolvedValue({ data: { data: { contrat: {} } } });
  api.put.mockResolvedValue({ data: { data: { contrat: {} } } });
  api.delete.mockResolvedValue({});
});

describe('CDS-FE — Typed rental surface', () => {
  it('CDS-FE-01 (rental list → /contrats/location)', async () => {
    await getRentalContracts({ statut: 'actif' });
    expect(api.get).toHaveBeenCalledWith('/contrats/location', { params: { statut: 'actif' } });
  });
  it('CDS-FE-05 (rental update → PUT /contrats/location/:id)', async () => {
    await updateRentalContract('c1', { montantLoyer: 400000 });
    expect(api.put).toHaveBeenCalledWith('/contrats/location/c1', { montantLoyer: 400000 });
  });
  it('CDS-FE-07 (rental delete → DELETE /contrats/location/:id)', async () => {
    await deleteRentalContract('c1');
    expect(api.delete).toHaveBeenCalledWith('/contrats/location/c1');
  });
  it('CDS-FE-11 (rental payments → GET /contrats/location/:id/paiements)', async () => {
    await getRentalContractPayments('c1', 2027);
    expect(api.get).toHaveBeenCalledWith('/contrats/location/c1/paiements', { params: { annee: 2027 } });
  });
});

describe('CDS-FE — Typed sale surface', () => {
  it('CDS-FE-02 (sale list → /contrats/vente)', async () => {
    await getSaleContracts({});
    expect(api.get).toHaveBeenCalledWith('/contrats/vente', { params: {} });
  });
  it('CDS-FE-06 (sale update → PUT /contrats/vente/:id)', async () => {
    await updateSaleContract('c2', { prixVente: 6000000 });
    expect(api.put).toHaveBeenCalledWith('/contrats/vente/c2', { prixVente: 6000000 });
  });
  it('CDS-FE-08 (sale delete → DELETE /contrats/vente/:id)', async () => {
    await deleteSaleContract('c2');
    expect(api.delete).toHaveBeenCalledWith('/contrats/vente/c2');
  });
});

describe('CDS-FE — Resource-driven dispatch (§3, §8, §14, §15)', () => {
  it('CDS-FE-14a (updateContratByResource routes to rental when resource.type=location)', async () => {
    await updateContratByResource({ _id: 'r1', type: 'location' }, { montantLoyer: 1 });
    expect(api.put).toHaveBeenCalledWith('/contrats/location/r1', { montantLoyer: 1 });
  });
  it('CDS-FE-14b (routes to sale when resource.type=vente)', async () => {
    await updateContratByResource({ _id: 's1', type: 'vente' }, { prixVente: 1 });
    expect(api.put).toHaveBeenCalledWith('/contrats/vente/s1', { prixVente: 1 });
  });
  it('CDS-FE-15 (payload.type does NOT switch mutation domain — resource wins)', async () => {
    await updateContratByResource({ _id: 'r1', type: 'location' }, { type: 'vente', prixVente: 999 });
    // La route reste rentale : c'est ensuite le backend qui rejette 400 le
    // champ interdit `type` (CDS-12/13), garantie défense en profondeur.
    expect(api.put).toHaveBeenCalledWith('/contrats/location/r1', { type: 'vente', prixVente: 999 });
    expect(api.put).not.toHaveBeenCalledWith(expect.stringMatching(/\/contrats\/vente\//), expect.anything());
  });
  it('CDS-FE-14c (deleteContratByResource routes correctly)', async () => {
    await deleteContratByResource({ _id: 'r1', type: 'location' });
    expect(api.delete).toHaveBeenCalledWith('/contrats/location/r1');
    await deleteContratByResource({ _id: 's1', type: 'vente' });
    expect(api.delete).toHaveBeenCalledWith('/contrats/vente/s1');
  });
  it('CDS-FE-14d (dispatcher throws on unknown type — no fallback to legacy)', async () => {
    await expect(updateContratByResource({ _id: 'x1', type: undefined }, {})).rejects.toThrow(/inconnu/i);
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('CDS-FE — No legacy mutation reintroduced (§9, §10, §12)', () => {
  it('CDS-FE-09/10 (dispatchers never emit legacy /contrats/:id mutations)', async () => {
    await updateContratByResource({ _id: 'r1', type: 'location' }, {});
    await updateContratByResource({ _id: 's1', type: 'vente' }, {});
    await deleteContratByResource({ _id: 'r2', type: 'location' });
    await deleteContratByResource({ _id: 's2', type: 'vente' });
    const putUrls = api.put.mock.calls.map((c) => c[0]);
    const delUrls = api.delete.mock.calls.map((c) => c[0]);
    for (const u of [...putUrls, ...delUrls]) {
      expect(u).not.toMatch(/^\/contrats\/[a-zA-Z0-9]+$/); // no bare /contrats/<id>
      expect(u).toMatch(/^\/contrats\/(location|vente)\//);
    }
  });
  it('CDS-FE-12 (no legacy payment POST introduced — no api.post to /contrats/:id/paiements)', async () => {
    await getRentalContractPayments('r1');
    const postUrls = api.post.mock.calls.map((c) => c[0]);
    for (const u of postUrls) {
      expect(u).not.toMatch(/\/contrats\/[^/]+\/paiements$/);
    }
  });
});

describe('CDS-FE — Preserved compat surfaces (§7, §11, §17)', () => {
  it('CDS-FE-19 (polymorphic legacy GET /contrats retained for aggregated UI reads)', async () => {
    await getContrats({ type: 'location' });
    expect(api.get).toHaveBeenCalledWith('/contrats', { params: { type: 'location' } });
  });
  it('CDS-FE-20 (POST /contrats marketplace formation unchanged)', async () => {
    await createContrat({ type: 'location', bien: 'p1' });
    expect(api.post).toHaveBeenCalledWith('/contrats', { type: 'location', bien: 'p1' });
  });
});
