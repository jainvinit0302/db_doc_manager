# my-project

DBDocManager Project

## Quick Start Guide (CLI)

1. **Initialize Project**

   ```bash
   dbdoc init my-project
   cd my-project
   ```

2. **Introspect Database (Optional)**

   ```bash
   # Auto-generate DSL from existing DB
   dbdoc introspect postgres "postgresql://user:pass@localhost/mydb" --out schema.yaml
   ```

3. **Validate DSL**

   ```bash
   dbdoc validate schema.yaml
   ```

4. **Generate Documentation**

   ```bash
   dbdoc generate schema.yaml --out docs
   ```

5. **Serve Documentation**

   ```bash
   dbdoc serve --dir docs
   ```

## Learn More

- [DBDocManager Docs](https://github.com/yourorg/dbdoc-manager)
- [DSL Reference](https://github.com/yourorg/dbdoc-manager/docs/dsl)
