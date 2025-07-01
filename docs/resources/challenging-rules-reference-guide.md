# Reference Guide: Most Challenging Rules and Expert Solutions

## Universal Patterns

**Complex type constraints**

```python
# Python: Use Protocol for structural typing
from typing import Protocol

class Comparable(Protocol):
    def __lt__(self, other: Any) -> bool: ...

def sort_items[T: Comparable](items: list[T]) -> list[T]:
    return sorted(items)
```

```typescript
// TypeScript: Conditional types for flexibility
type AsyncReturnType<T> = T extends (...args: any[]) => Promise<infer R> ? R : never;

// Usage maintains clarity
type UserData = AsyncReturnType<typeof fetchUser>; // Infers User type
```

**Configuration management**

```ini
# .flake8 - Start conservative
[flake8]
max-line-length = 88
extend-ignore = E203, W503
per-file-ignores =
    __init__.py: F401
    tests/*: S101
```

```json
// tsconfig.json - Gradual strictness
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false, // Enable after refactor
    "noUncheckedIndexedAccess": true
  }
}
```

## Python

**Type annotation completeness (mypy strict mode)**

```python
# Challenge: Function requires full annotation
# ❌ Triggers error
def process_data(items):
    return [x.upper() for x in items if x]

# ✅ Expert solution: Use generics for flexibility
from typing import TypeVar, Iterable, List

T = TypeVar('T', bound=str)

def process_data(items: Iterable[T]) -> List[T]:
    return [x.upper() for x in items if x]
```

**TRY003: Long exception messages**

```python
# ❌ Variable assignment anti-pattern
msg = "Invalid configuration: missing required field"
raise ValueError(msg)

# ✅ Domain exception pattern
class MissingFieldError(ValueError):
    def __init__(self, field: str):
        super().__init__(f"Invalid configuration: missing required field '{field}'")
```

**Line length (E501) with complex logic**

```python
# ❌ Unreadable line break
if (user.is_authenticated and user.has_permission('admin') and \
    not user.is_suspended and user.last_login > thirty_days_ago):

# ✅ Extract semantic conditions
is_active_admin = (
    user.is_authenticated
    and user.has_permission('admin')
    and not user.is_suspended
)
is_recently_active = user.last_login > thirty_days_ago

if is_active_admin and is_recently_active:
```

**Unused variables in comprehensions (F841)**

```python
# ❌ Unused loop variable
for _ in range(10):
    process_item()

# ✅ Explicit intent with underscore
for _ in range(10):  # Repeat 10 times
    process_item()
```

### Decision Matrix

| Rule Type          | Suppress  | Refactor | Architectural Change         |
| ------------------ | --------- | -------- | ---------------------------- |
| Type completeness  | Never     | Always   | When patterns emerge         |
| Line length        | Rarely    | Usually  | For complex expressions      |
| Exception messages | Never     | Rarely   | Always (use custom types)    |
| Null checks        | Never     | Always   | When null represents state   |
| Unused vars        | Sometimes | Usually  | For intentional placeholders |

### Key Principles

1. **Semantic wins over syntax**: If satisfying a rule reduces clarity, refactor to a clearer structure that naturally
   satisfies the rule
2. **Types as documentation**: Well-named types and interfaces eliminate the need for comments
3. **Gradual enforcement**: Enable rules incrementally, fixing the codebase section by section
4. **Team alignment**: Rules should codify team agreements, not impose external standards
5. **Automation over discipline**: Use formatters (Black, Prettier) to eliminate style debates

Remember: The goal isn't to satisfy linters—it's to write maintainable code. Linters merely help us achieve that goal
consistently.
