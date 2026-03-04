using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using TemplateApi.Data;

var builder = WebApplication.CreateBuilder(args);

var envCandidates = new[]
{
    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), ".env")),
    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", ".env")),
    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env"))
};

foreach (var envPath in envCandidates)
{
    if (File.Exists(envPath))
    {
        Env.Load(envPath);
        break;
    }
}

builder.Configuration.AddEnvironmentVariables();

builder.Services.AddOpenApi();

var corsOrigin = builder.Configuration["CORS_ORIGIN"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(corsOrigin).AllowAnyHeader().AllowAnyMethod());
});

var microsoftTenant = builder.Configuration["MICROSOFT_TENANT_ID"];
var inlogTenant = builder.Configuration["INLOG_MICROSOFT_TENANT_ID"];
if (!string.IsNullOrWhiteSpace(inlogTenant))
{
    microsoftTenant = inlogTenant;
}
var microsoftClientId = builder.Configuration["MICROSOFT_CLIENT_ID"];
var inlogClientId = builder.Configuration["INLOG_MICROSOFT_CLIENT_ID"];
if (!string.IsNullOrWhiteSpace(inlogClientId))
{
    microsoftClientId = inlogClientId;
}
var microsoftAuthEnabled = (builder.Configuration["MICROSOFT_AUTH_ENABLED"] ?? "1") != "0";
var authEnabled = microsoftAuthEnabled
    && !string.IsNullOrWhiteSpace(microsoftTenant)
    && !string.IsNullOrWhiteSpace(microsoftClientId);

if (authEnabled)
{
    var validateIssuer = !new[] { "common", "organizations", "consumers" }
        .Contains(microsoftTenant!, StringComparer.OrdinalIgnoreCase);
    var authority = $"https://login.microsoftonline.com/{microsoftTenant}/v2.0";

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = authority;
            options.Audience = microsoftClientId;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = validateIssuer
            };
        });
    builder.Services.AddAuthorization();
}

var dbServer = builder.Configuration["DB_SERVER"];
var dbConfigured = !string.IsNullOrWhiteSpace(dbServer);

if (dbConfigured)
{
    var dbPort = builder.Configuration["DB_PORT"] ?? "1433";
    var dbName = builder.Configuration["DB_NAME"] ?? "";
    var dbUser = builder.Configuration["DB_USER"] ?? "";
    var dbPassword = builder.Configuration["DB_PASSWORD"] ?? "";
    var connectionString =
        $"Server={dbServer},{dbPort};Database={dbName};User Id={dbUser};Password={dbPassword};TrustServerCertificate=True;Encrypt=False;";

    builder.Services.AddDbContext<TemplateDbContext>(options =>
        options.UseSqlServer(connectionString));
}

var dotnetPort = builder.Configuration["DOTNET_PORT"];
if (!string.IsNullOrWhiteSpace(dotnetPort))
{
    builder.WebHost.UseUrls($"http://localhost:{dotnetPort}");
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("frontend");
if (authEnabled)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapGet("/api/health", (IConfiguration config) =>
{
    return Results.Ok(new
    {
        status = "ok",
        env = config["ENVIRONMENT"] ?? "Local"
    });
});

app.MapGet("/api/profile", () =>
{
    return Results.Ok(new
    {
        id = "user-001",
        name = "Template User",
        role = "Admin",
        status = "Active"
    });
});

app.MapGet("/api/settings", (IConfiguration config) =>
{
    var localAuthEnabled = (config["LOCAL_AUTH_ENABLED"] ?? "1") != "0";
    return Results.Ok(new
    {
        sidebarOrientation = "vertical",
        localAuthEnabled,
        featureFlags = new
        {
            enableUserSettings = config["FEATURE_ENABLE_USER_SETTINGS"] == "1"
        },
        hasMicrosoftClient = authEnabled
    });
});

if (authEnabled)
{
    app.MapGet("/api/secure/profile", (ClaimsPrincipal user) =>
    {
        var name = user.FindFirst(ClaimTypes.Name)?.Value ?? user.Identity?.Name ?? "Microsoft User";
        var oid = user.FindFirst("oid")?.Value ?? "user-001";
        return Results.Ok(new
        {
            id = oid,
            name,
            role = "Authenticated",
            status = "Active"
        });
    }).RequireAuthorization();
}
else
{
    app.MapGet("/api/secure/profile", () =>
        Results.Problem(
            microsoftAuthEnabled
                ? "Microsoft auth is not configured."
                : "Microsoft auth is disabled.",
            statusCode: StatusCodes.Status501NotImplemented));
}

if (dbConfigured)
{
    app.MapGet("/api/db/health", async (TemplateDbContext db) =>
    {
        var canConnect = await db.Database.CanConnectAsync();
        return Results.Ok(new { ok = canConnect });
    });

    app.MapGet("/api/db/info", async (TemplateDbContext db) =>
    {
        var info = await db.DatabaseInfos
            .FromSqlRaw("SELECT DB_NAME() AS DatabaseName, SUSER_SNAME() AS LoginName, @@VERSION AS VersionInfo")
            .FirstOrDefaultAsync();

        return Results.Ok(info);
    });
}
else
{
    app.MapGet("/api/db/health", () =>
        Results.Problem("Database is not configured.", statusCode: StatusCodes.Status501NotImplemented));
    app.MapGet("/api/db/info", () =>
        Results.Problem("Database is not configured.", statusCode: StatusCodes.Status501NotImplemented));
}

app.Run();
