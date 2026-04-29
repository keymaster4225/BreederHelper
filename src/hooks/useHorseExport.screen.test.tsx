import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/horseTransfer', () => ({
  exportMareTransfer: jest.fn(),
  exportStallionTransfer: jest.fn(),
  shareHorseTransferFileIfAvailable: jest.fn(),
  writeHorseTransferFile: jest.fn(),
}));

const horseTransfer = jest.requireMock('@/storage/horseTransfer') as {
  exportMareTransfer: jest.Mock;
  exportStallionTransfer: jest.Mock;
  shareHorseTransferFileIfAvailable: jest.Mock;
  writeHorseTransferFile: jest.Mock;
};

import { useHorseExport } from './useHorseExport';

describe('useHorseExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    horseTransfer.writeHorseTransferFile.mockResolvedValue({
      fileName: 'breedwise-mare-nova-v1-20260428-120000.json',
      fileUri: 'file:///breedwise-mare-nova-v1-20260428-120000.json',
      jsonText: '{}',
    });
    horseTransfer.shareHorseTransferFileIfAvailable.mockResolvedValue(true);
  });

  it('exports, writes, and shares a mare package', async () => {
    const envelope = { sourceHorse: { type: 'mare', name: 'Nova' } };
    horseTransfer.exportMareTransfer.mockResolvedValue(envelope);

    const { result } = renderHook(() => useHorseExport());

    let exportResult: Awaited<ReturnType<typeof result.current.exportMarePackage>> | null = null;
    await act(async () => {
      exportResult = await result.current.exportMarePackage('mare-1');
    });

    expect(horseTransfer.exportMareTransfer).toHaveBeenCalledWith('mare-1');
    expect(horseTransfer.writeHorseTransferFile).toHaveBeenCalledWith(envelope);
    expect(horseTransfer.shareHorseTransferFileIfAvailable).toHaveBeenCalledWith(
      'file:///breedwise-mare-nova-v1-20260428-120000.json',
    );
    expect(exportResult).toEqual({
      ok: true,
      fileName: 'breedwise-mare-nova-v1-20260428-120000.json',
      fileUri: 'file:///breedwise-mare-nova-v1-20260428-120000.json',
      shared: true,
    });
    expect(result.current.errorMessage).toBeNull();
  });

  it('returns a failure when stallion serialization fails', async () => {
    horseTransfer.exportStallionTransfer.mockRejectedValue(new Error('Stallion st-1 was not found.'));

    const { result } = renderHook(() => useHorseExport());

    let exportResult: Awaited<ReturnType<typeof result.current.exportStallionPackage>> | null = null;
    await act(async () => {
      exportResult = await result.current.exportStallionPackage('st-1');
    });

    expect(exportResult).toEqual({
      ok: false,
      errorMessage: 'Stallion st-1 was not found.',
    });
    expect(result.current.errorMessage).toBe('Stallion st-1 was not found.');
    expect(horseTransfer.writeHorseTransferFile).not.toHaveBeenCalled();
  });

  it('reports success with shared false when sharing is unavailable', async () => {
    horseTransfer.exportMareTransfer.mockResolvedValue({ sourceHorse: { type: 'mare' } });
    horseTransfer.shareHorseTransferFileIfAvailable.mockResolvedValue(false);

    const { result } = renderHook(() => useHorseExport());

    let exportResult: Awaited<ReturnType<typeof result.current.exportMarePackage>> | null = null;
    await act(async () => {
      exportResult = await result.current.exportMarePackage('mare-1');
    });

    expect(exportResult).toEqual(expect.objectContaining({ ok: true, shared: false }));
  });

  it('reports success with shared false when sharing throws', async () => {
    horseTransfer.exportMareTransfer.mockResolvedValue({ sourceHorse: { type: 'mare' } });
    horseTransfer.shareHorseTransferFileIfAvailable.mockRejectedValue(new Error('Share unavailable.'));

    const { result } = renderHook(() => useHorseExport());

    let exportResult: Awaited<ReturnType<typeof result.current.exportMarePackage>> | null = null;
    await act(async () => {
      exportResult = await result.current.exportMarePackage('mare-1');
    });

    expect(exportResult).toEqual(expect.objectContaining({ ok: true, shared: false }));
    expect(result.current.errorMessage).toBeNull();
  });

  it('rejects overlapping export attempts', async () => {
    let resolveEnvelope: (value: unknown) => void = () => undefined;
    const envelopePromise = new Promise((resolve) => {
      resolveEnvelope = resolve;
    });
    horseTransfer.exportMareTransfer.mockReturnValue(envelopePromise);

    const { result } = renderHook(() => useHorseExport());

    let firstExport: Promise<Awaited<ReturnType<typeof result.current.exportMarePackage>>>;
    act(() => {
      firstExport = result.current.exportMarePackage('mare-1');
    });

    await waitFor(() => expect(result.current.isExporting).toBe(true));

    let secondExport: Awaited<ReturnType<typeof result.current.exportMarePackage>> | null = null;
    await act(async () => {
      secondExport = await result.current.exportMarePackage('mare-1');
    });

    expect(secondExport).toEqual({
      ok: false,
      errorMessage: 'Horse package export is already in progress.',
    });
    expect(horseTransfer.exportMareTransfer).toHaveBeenCalledTimes(1);

    resolveEnvelope({ sourceHorse: { type: 'mare' } });
    await act(async () => {
      await firstExport;
    });
    expect(result.current.isExporting).toBe(false);
  });
});
