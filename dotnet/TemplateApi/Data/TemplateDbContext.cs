using Microsoft.EntityFrameworkCore;
using TemplateApi.Models;

namespace TemplateApi.Data;

public class TemplateDbContext : DbContext
{
    public TemplateDbContext(DbContextOptions<TemplateDbContext> options) : base(options)
    {
    }

    public DbSet<DbInfo> DatabaseInfos => Set<DbInfo>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DbInfo>().HasNoKey();
        base.OnModelCreating(modelBuilder);
    }
}
