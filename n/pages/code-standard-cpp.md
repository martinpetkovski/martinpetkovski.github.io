# C++ Code Standard

## Naming

When using Naming Conventions, all code and comments should use U.S. English spelling and grammar.

Functions are verbs, variables are nouns.

Global variables are prefixed by "g" .

	float gGlobalFloat;

Local variables and function arguments use PascalCase.

	void SomeFunction(float ArgumentName)
	{
		float LocalVariable = 0.0f;
	}

Member variables also use PascalCase, without a prefix.

	class Vehicle
	{
		private:
			float MemberVariable = 0.0f;
			float SomethingElse = 0.0f;
	};

Functions, enums, namespaces, classes and structs use PascalCase.

	float FunctionName()
	
	enum class VehicleType
	class VehicleCar
	struct VehicleParameters

Macros and labels are UPPERCASE_UNDERSCORE.

	#define USE_POINTER
	SOME_LABEL:

Enums should be scoped with enum class. Enum members are named using PascalCase, each one in a new row.

	enum class Elements
	{
		Air,
		Water,
		Earth,
		Sand,
		FifthElement
	}

Unscoped enum members should have the "k" prefix.

	enum Elements
	{
		kAir,
		kWater,
		kEarth,
		kSand,
		kFifthElement
	}

File names should be consistent within a single project. They should contain a prefix.

> Rationale: They pop-out when searching for something solution-wide.

Names of functions that return boolean should be formatted as questions, preferrably with the prefix **Is**. 

Good examples: 

	bool IsWalking();
	bool IsRunning();

Bad examples:

	bool CheckWalking();

## Unreal Engine specifics

Template classes are prefixed by T.

	template <typename ObjectType>
	class TAttribute

Classes that inherit from UObject are prefixed by U.

	class UActorComponent

Classes that inherit from AActor are prefixed by A.

	class AActor

Classes that inherit from SWidget are prefixed by S.

	class SCompoundWidget

Classes that are abstract interfaces are prefixed by I.

	class IAnalyticsProvider

Epic's concept-alike struct types are prefixed by C.

	struct CStaticClassProvider
	{
		template <typename T>
		auto Requires(UClass*& ClassRef) -> decltype(
			ClassRef = T::StaticClass()
		);
	};

Enums are prefixed by E.

	enum class EColorBits
	{
	    ECB_Red,
	    ECB_Green,
	    ECB_Blue
	};

Boolean variables must be prefixed by b.

	bPendingDestruction
	bHasFadedIn

A typedef of a particular template instantiation is no longer a template and should be prefixed accordingly.

	typedef TArray<FMytype> FArrayOfMyTypes;

Disambiguate template parameters from aliases by using an In prefix:

	template <typename InElementType>
	class TContainer
	{
	public:
	    using ElementType = InElementType;
	};

Macro names should be fully capitalized with words separated by underscores, and prefixed with UE_.

	#define UE_AUDIT_SPRITER_IMPORT

## Indentation

Indent using tabs. Tabs are 4 characters.

> Rationale: It's enough to be clear and is the default in most good IDEs (i.e. Visual Studio).

If you are indenting more than 5 times, you should consider splitting the function.

Don't put multiple statements on a single line unless you have something to hide:

	if (Condition) DontDoThis();
	DoSomethingEverytime();

Don't put multiple assignments on a single line.

	DontDoThis = 6; Please = 7;

## Line length

The preferred column limit is 120 characters.

> Rationale: A vertically oriented monitor (1080p) on 100% document zoom will fit all lines of 120 characters comfortably. 

If you have to split the line because you've reached the character limit, consider simplifying the expression. An exception are lengthy strings which should be split in multiple lines.

## Braces

All curly braces should be in their own line. 

	if (Condition)
	{
		DoSomething();
	}

Do not unnecessarily use braces where a single statement will do.

	if (Condition)
		Action();

and

	if (Condition)
		DoThis();
	else
		DoThat();

This does not apply if only one branch of a conditional statement is a single statement; in the latter case use braces in both branches:

	if (Condition) 
	{
		DoThis();
		DoThat();
	} 
	else 
	{
		Otherwise();
	}

## Spaces

Use a space after these keywords:

	if, switch, case, for, do, while

but not with sizeof, typeof

	s = sizeof(a);

Do not add spaces around (inside) parenthesized expressions. This example is **bad**:

	s = sizeof( a );

When declaring pointer data or a function that returns a pointer type, the preferred use of * is adjacent to the type name or function type and not adjacent to the variable or function name. Examples:

	 char* stringOfText;
	 void* SomeFunction(const float* someArg);

> Rationale: The * is a modifier to the type, not to the name.

Use one space around (on each side of) most binary and ternary operators, such as any of these:

	=  +  -  <  >  *  /  %  |  &  ^  <=  >=  ==  !=  ?  :

but no space after (or before) unary operators:

	&  *  +  -  ++ --  ~  !  sizeof  typeof 

## Reference vs Pointer

Heavily depends on the context. In general, references are preferred over pointers. A good rule of thumb is to use pointer wherever something can be invalid. Don't be afraid to check for validity.

## Const-correctness

All functions, their input arguments and output type must be const-correct, where applicable. Member variables must be const-correct. Local variables should be const-correct, but don't have to be.

## Macros

Avoid using them as much as possible. Don't define constants using macros, instead use global constant variables. Use inline functions instead of macro functions where possible. 

> Rationale: Improves readability, can be debugged more easily and  because of consistency (all functions should be actual functions), among other things. 

With that said, here are some exceptions:
- When used in if-defs.
- When using preprocessor operators is a must.
- When simplifying super-complex template expressions (you should consider changing the template definitions to be simpler).

Macros that resemble functions are heresy.

	#define FOO(x)               \
	({                           \
			typeof(x) ret;       \
			ret = CalcRet(x);   \
			(ret);               \
	}) 
	// WHY?

## Namespaces

Namespaces should be per-project or context-based. A general rule of thumb is to put stuff in namespaces whenever you suspect that there might be a naming conflict. Such examples include functions that can easily be found unscoped in other projects: min(), max(), avg() and so on.

No more than 2 nested namespaces should be used.

Writing

	using namespace Whatever;

is forbidden.

## Functions

Functions should be short and sweet, and do just one thing. They should fit on one screenful of text which is 50 lines.

> Rationale: 50 lines can fit comfortably on a horizontally oriented 1080p monitor with 100% zoom.

The maximum length of a function is inversely proportional to the complexity and indentation level of that function. So, if you have a conceptually simple function that is just one long if-else statement, where you have to do lots of small things for a lot of different cases, it's OK to have a longer function.

Another measure of the function is the number of local variables. They shouldn't exceed 5-10, or you're doing something wrong.

Use helper functions with descriptive names.

## Returning from functions and loops

Functions which contain a single return statement are preferred. Use early-outs only if they are located immediately after the beginning of the function.

Example:

	int SomeFunction(Vehicle* SomeCar)
	{
		if(!SomeCar)
			return 0;
		
		int RetVal = 0;

		if(Condition)
		{
			RetVal = DoSomethingElse(SomeCar);
		}
		
		return RetVal; 
	}

The same rule of thumb goes for exiting loops.

Example:

	for(SomePointer* Pointer : ArrayOfPointers)
	{
		if(!Pointer)
			continue;

		DoWhatever();
	}

Bad example:

	for(SomePointer* Pointer : ArrayOfPointers)
	{
		DoWhatever();

		if(!Pointer)
			continue;

		DoSomethingElse();
	}

## Lambda expressions

Discouraged. Use pointers to functions instead.

## auto

Discouraged. Lazy people coming from JavaScript use this, doesn't improve readability at all. Exception are iterators, but still avoid them.

	const auto& Iterator = SomeMap.find(SomeValue);

## inline

A reasonable rule of thumb is to not put inline at functions that have more than 3 lines of code in them.

## goto

Allowed, depending on the use case.

Example when breaking out of a nested for loop:

	for(size_t i = 0; i < 10; i++)
	{
		for(size_t j = 0; j < 10; j++)
		{
			if(Condition)
			{
				goto SOME_LABEL;
			}
		}
	}
	
	SOME_LABEL:
	DoSomething();

## Classes and structs

Ordering of access specifiers should be as follows:
- public
- protected
- private

> Rationale: You're most likely looking for a public function name, so it should be listed at the top.

Ordering of class members should be as follows:
- `friend`
- nested classes, enums, structs
- typedefs
- const members
- member variables
- functions

> Rationale: You're most likely to use a nested class to declare a member variable and then use it in a function.

For non-compound types it's preferred to have getters and setters for member variables.

Forward declare types wherever applicable. Avoid mixing forward declarations with variable declarations.

Structs should be used whenever the member variables are independently mutable. Examples:

	struct Vehicle
	{
		public:
			int NumWheels;
			float Horsepower;
	}

as opposed to

	class Vehicle
	{
		private: 
			float Horsepower
			float FuelConsumption
			
		public:
			void SetHorsepower(float Value)
			{
				Horsepower = Value;
				FuelConsumption = Horsepower * 0.3f;
			}
	};

Don't put code that can fail inside constructors.

## Header files

Header files should contain only function declarations. Exception to this rule are getters and setters which can be written in a single line.

Good:

	SomeType* GetSomething() { return Something; }

Bad:

	void SetSomething(const SomeType& Something) { this.Something = Something; TestSomething(Something); }

Inline templates can be left inside header files but they should be physically separated from the definitions.

Always include everything you need, don't rely on implicit includes. Include as little as possible inside header files and as much as needed in source files.

The ordering of the header files, from top to bottom, should be as follows: 

- The mandatory precompiled header (if applicable).
- The header file corresponding to the current source file.
- Project header files (#include "").
- External header files (#include <>).

## Casting

C-style casts are discouraged. Most of the time you will be upcasting using `static_cast` and downcasting using `dynamic_cast`.  If you're tempted to use `const_cast` make sure you're using it for the right reasons (simply getting rid of the const modifier is NOT a right reason). Avoid using `reinterpret_cast` unless absolutely necessary.  

## Patterns / Techniques

### RAII

Yes.

### Dependency Injection

Yes, but keep the initialization as close as possible to the usage location.

### Static

Discouraged. All classes will have to be instanced more than once at some point. Create global instances instead.

### Singleton 

Discouraged. Create global instances instead.

## STD Exceptions

Discouraged when not writing a library.

> Rationale: You probably have a logger or something, use that instead.

## Commenting

Write comments in header files. Do not try to explain **how** a function works in the comments. Instead, write the purpose and intention of the function and what's the expected result. The code in source files should be self-explanatory. 

	/* The preferred comment style looks like this.
	 *
	 * Description:  A column of asterisks on the left side,
	 * with beginning and ending almost-blank lines.
	 */

**todo** comments should follow the format:
	
	//#todo [source control username]: Your comment goes here
	//#todo martin: Fix this line
	
## Enforcement

No one should enforce the code standard and have the power to block development because of minor incursions. Everyone should understand that following the code standard will make the code more readable, understandable and maintainable. Others will benefit from it equally as much as yourself in 2 weeks time.

## References

- https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines
- https://www.kernel.org/doc/html/v4.10/process/coding-style.html
- https://docs.unrealengine.com/4.27/en-US/ProductionPipelines/DevelopmentSetup/CodingStandard/
- Myself