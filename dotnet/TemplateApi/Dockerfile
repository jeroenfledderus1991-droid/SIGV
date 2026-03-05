FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY dotnet/TemplateApi/TemplateApi.csproj dotnet/TemplateApi/
RUN dotnet restore dotnet/TemplateApi/TemplateApi.csproj

COPY dotnet/TemplateApi/ dotnet/TemplateApi/
RUN dotnet publish dotnet/TemplateApi/TemplateApi.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

EXPOSE 5302

ENTRYPOINT ["dotnet", "TemplateApi.dll"]
