/**
 * Minimal test to verify Jest mocking works
 */

describe("Jest Mock Test", () => {
  it("should be able to use jest.fn()", () => {
    const mockFn = jest.fn();
    mockFn("test");
    expect(mockFn).toHaveBeenCalledWith("test");
  });

  it("should be able to mock implementation", () => {
    const mockFn = jest.fn().mockReturnValue("mocked");
    expect(mockFn()).toBe("mocked");
  });
});
