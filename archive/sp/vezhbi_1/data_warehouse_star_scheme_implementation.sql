-- креирај ја базата на податоци data_warehouse_star_scheme_implementation ако не постои
CREATE DATABASE IF NOT EXISTS data_warehouse_star_scheme_implementation;

-- употреба на командата USE со цел sql фајлот да може да биде директно извршен од конзола 
-- и да ја користи претходно креираната база на податоци
USE data_warehouse_star_scheme_implementation;

-- димензионалната табела за продукти
CREATE TABLE IF NOT EXISTS DimProduct
(ProductKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
ProductAltKey nvarchar(10) NOT NULL,
ProductName nvarchar(50) NULL,
ProductDescription nvarchar(100) NULL,
ProductCategoryName nvarchar(50));

-- димензионалната табела за потрошувачи
CREATE TABLE IF NOT EXISTS DimCustomer
(CustomerKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
CustomerAltKey nvarchar(10) NOT NULL,
CustomerName nvarchar(50) NULL,
CustomerEmail nvarchar(50) NULL,
CustomerGeographyKey int NULL);

-- димензионалната табела за луѓе кои продаваат
CREATE TABLE IF NOT EXISTS DimSalesperson
(SalespersonKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
SalesPersonAltKey nvarchar(10) NOT NULL,
SalespersonName nvarchar(50) NULL,
StoreName nvarchar(50) NULL,
StoreGeographyKey int NULL);

-- димензионалната табела за дефинирање на временските податоци
CREATE TABLE IF NOT EXISTS DimDate
(DateKey int AUTO_INCREMENT NOT NULL PRIMARY KEY,
DateAltKey datetime NOT NULL,
CalendarYear int NOT NULL,
CalendarQuarter int NOT NULL,
MonthOfYear int NOT NULL,
MonthName nvarchar(15) NOT NULL,
DayOfMonth int NOT NULL,
DayOfWeek int NOT NULL,
DayName nvarchar(15) NOT NULL,
FiscalYear int NOT NULL,
FiscalQuarter int NOT NULL);

-- табелата на факти која ги обединува сите претходни димензионални табели
CREATE TABLE IF NOT EXISTS FactSalesOrders
(ProductKey int NOT NULL,
CustomerKey int NOT NULL,
SalespersonKey int NOT NULL,
OrderDateKey int NOT NULL,
OrderNo int NOT NULL,
ItemNo int NOT NULL,
Quantity int NOT NULL,
SalesAmount int NOT NULL,
Cost int NOT NULL,
FOREIGN KEY(ProductKey) REFERENCES DimProduct(ProductKey),
FOREIGN KEY(CustomerKey) REFERENCES DimCustomer(CustomerKey),
FOREIGN KEY(SalespersonKey) REFERENCES DimSalesperson(SalespersonKey),
FOREIGN KEY(OrderDateKey) REFERENCES DimDate(DateKey),
CONSTRAINT PK_FactSalesOrder PRIMARY KEY
(
	ProductKey,CustomerKey,SalespersonKey,OrderDateKey,OrderNo,ItemNo
));