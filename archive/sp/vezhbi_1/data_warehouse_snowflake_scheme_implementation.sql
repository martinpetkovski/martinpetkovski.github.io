CREATE DATABASE IF NOT EXISTS data_warehouse_snowflake_scheme_implementation DEFAULT CHARACTER SET utf8;

USE data_warehouse_snowflake_scheme_implementation;

CREATE TABLE IF NOT EXISTS DimDate
(DateKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
Year int NOT NULL,
Quarter int NOT NULL,
Month int NOT NULL,
Day int NOT NULL);

CREATE TABLE IF NOT EXISTS DimShippingAgent
(ShippingAgentKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
ShippingAgentName int NOT NULL);

CREATE TABLE IF NOT EXISTS DimSupplier
(SupplierKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
SupplierName nvarchar(50) NOT NULL);

CREATE TABLE IF NOT EXISTS DimProductLine
(ProductLineKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
ProductLineName nvarchar(50) NOT NULL);

CREATE TABLE IF NOT EXISTS DimProduct
(ProductKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
ProductName nvarchar(50) NOT NULL,
ProductLineKey int NOT NULL,
SupplierKey int NOT NULL,
FOREIGN KEY(ProductLineKey) REFERENCES DimProductLine(ProductLineKey),
FOREIGN KEY(SupplierKey) REFERENCES DimSupplier(SupplierKey));

CREATE TABLE IF NOT EXISTS DimGeography
(GeographyKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
City nvarchar(50) NOT NULL,
Region nvarchar(50) NOT NULL);

CREATE TABLE IF NOT EXISTS DimCustomer
(CustomerKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
CustomerName nvarchar(50) NOT NULL,
GeographyKey int NOT NULL,
FOREIGN KEY(GeographyKey) REFERENCES DimGeography(GeographyKey));

CREATE TABLE IF NOT EXISTS DimStore
(StoreKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
StoreName nvarchar(50) NOT NULL,
GeographyKey int NOT NULL,
FOREIGN KEY(GeographyKey) REFERENCES DimGeography(GeographyKey));

CREATE TABLE IF NOT EXISTS DimSalesPerson
(SalesPersonKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
SalesPersonName nvarchar(50) NOT NULL,
StoreKey int NOT NULL,
FOREIGN KEY(StoreKey) REFERENCES DimStore(StoreKey));

CREATE TABLE IF NOT EXISTS FactOrders
(CustomerKey int NOT NULL,
SalesPersonKey int NOT NULL,
ProductKey int NOT NULL,
ShippingAgentKey int NOT NULL,
TimeKey int NOT NULL,
OrderNo int NOT NULL,
LineItemNo int NOT NULL,
Quantity int NOT NULL,
Revenue int NOT NULL,
Profit int NOT NULL,
FOREIGN KEY(CustomerKey) REFERENCES DimCustomer(CustomerKey),
FOREIGN KEY(SalesPersonKey) REFERENCES DimSalesPerson(SalesPersonKey),
FOREIGN KEY(ProductKey) REFERENCES DimProduct(ProductKey),
FOREIGN KEY(ShippingAgentKey) REFERENCES DimShippingAgent(ShippingAgentKey),
FOREIGN KEY(TimeKey) REFERENCES DimDate(DateKey),
CONSTRAINT PK_FactOrders PRIMARY KEY
(
	CustomerKey,SalesPersonKey,ProductKey,ShippingAgentKey,TimeKey
));