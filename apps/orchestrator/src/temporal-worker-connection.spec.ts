import { TemporalConnectionFactory } from 'nestjs-temporal-core/dist/providers/temporal-connection.factory';

const connect = jest.fn();

jest.mock('@temporalio/worker', () => ({
  NativeConnection: { connect },
}));

describe('Temporal worker connection', () => {
  const options = {
    connection: { address: 'temporal:7233' },
  };

  beforeEach(() => {
    connect.mockReset();
  });

  it('retries a temporary startup failure until Temporal is available', async () => {
    const connection = { close: jest.fn() };
    const startupError = new Error('connect ECONNREFUSED temporal:7233');
    connect
      .mockRejectedValueOnce(startupError)
      .mockResolvedValueOnce(connection);

    const retryTimer = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        queueMicrotask(callback);
        return {} as NodeJS.Timeout;
      });

    await expect(
      new TemporalConnectionFactory().createWorkerConnection(options)
    ).resolves.toBe(connection);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(retryTimer).toHaveBeenCalledWith(expect.any(Function), 2000);

    retryTimer.mockRestore();
  });

  it('throws after exhausting worker connection retries', async () => {
    const startupError = new Error('connect ECONNREFUSED temporal:7233');
    connect.mockRejectedValue(startupError);

    const retryTimer = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        queueMicrotask(callback);
        return {} as NodeJS.Timeout;
      });

    await expect(
      new TemporalConnectionFactory().createWorkerConnection(options)
    ).rejects.toBe(startupError);

    expect(connect).toHaveBeenCalledTimes(30);
    expect(retryTimer).toHaveBeenCalledTimes(29);

    retryTimer.mockRestore();
  });
});
