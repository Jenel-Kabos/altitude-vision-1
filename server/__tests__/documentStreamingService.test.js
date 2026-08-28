const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');
const logger = require('../utils/logger');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');

jest.mock('../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

function responseDouble() {
  return {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
}

function upstreamDouble({ statusCode = 200, contentType, onPipe } = {}) {
  return {
    statusCode,
    headers: contentType ? { 'content-type': contentType } : {},
    resume: jest.fn(),
    pipe: jest.fn(onPipe),
  };
}

function mockGet(client, upstream) {
  return jest.spyOn(client, 'get').mockImplementation((_url, callback) => {
    const request = new EventEmitter();
    callback(upstream);
    return request;
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('streamRemoteDocument — contrat historique avant extraction', () => {
  test('rejette URL absente, protocole non HTTP et ne lance aucun appel réseau', () => {
    const httpGet = jest.spyOn(http, 'get');
    const httpsGet = jest.spyOn(https, 'get');
    for (const url of [undefined, '', 'file:///etc/passwd', 'ftp://example.test/file']) {
      const res = responseDouble();
      streamRemoteDocument({ url, name: 'document.pdf', res });
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Document indisponible.' });
    }
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpsGet).not.toHaveBeenCalled();
  });

  test.each([404, 500])('convertit un upstream %i en 502 avec la même erreur safe', (statusCode) => {
    const upstream = upstreamDouble({ statusCode });
    mockGet(https, upstream);
    const res = responseDouble();

    streamRemoteDocument({ url: 'https://cdn.example.test/missing', name: 'doc.pdf', res, context: { documentId: 'doc-1' } });

    expect(upstream.resume).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Impossible de récupérer le document.' });
    expect(logger.error).toHaveBeenCalledWith('rental_document.upstream_error', { documentId: 'doc-1', statusCode });
  });

  test('conserve content-type, disposition inline, filename nettoyé et headers privés', () => {
    const res = responseDouble();
    const upstream = upstreamDouble({ statusCode: 200, contentType: 'application/pdf' });
    mockGet(http, upstream);

    streamRemoteDocument({ url: 'http://cdn.example.test/document', name: 'bail\r\n"dangereux?.pdf', res });

    expect(res.setHeader.mock.calls).toEqual([
      ['Content-Type', 'application/pdf'],
      ['Content-Disposition', 'inline; filename="bail___dangereux_.pdf"'],
      ['Cache-Control', 'private, no-store'],
      ['X-Content-Type-Options', 'nosniff'],
    ]);
    expect(upstream.pipe).toHaveBeenCalledWith(res);
  });

  test('utilise application/octet-stream par défaut', () => {
    const res = responseDouble();
    const upstream = upstreamDouble();
    mockGet(https, upstream);
    streamRemoteDocument({ url: 'https://cdn.example.test/document', name: 'document', res });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
  });

  test('convertit une erreur réseau en 502 tant que les headers ne sont pas envoyés', () => {
    const request = new EventEmitter();
    jest.spyOn(https, 'get').mockReturnValue(request);
    const res = responseDouble();

    streamRemoteDocument({ url: 'https://cdn.example.test/document', name: 'document', res, context: { mailId: 'mail-1' } });
    request.emit('error', new Error('socket closed'));

    expect(res.status).toHaveBeenCalledWith(502);
    expect(logger.error).toHaveBeenCalledWith('rental_document.stream_failed', { mailId: 'mail-1', error: 'socket closed' });
  });

  test('ne tente pas une seconde réponse après une erreur réseau post-headers', () => {
    const request = new EventEmitter();
    jest.spyOn(https, 'get').mockReturnValue(request);
    const res = responseDouble();
    res.headersSent = true;

    streamRemoteDocument({ url: 'https://cdn.example.test/document', name: 'document', res });
    request.emit('error', new Error('late failure'));

    expect(res.status).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
