import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as custom_resources from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";

export class HogwartsNotificationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DB TABLE DEFINITION **************************************************
    const vpc = new ec2.Vpc(this, "HogwartsVPC", {
      maxAzs: 2,
      natGateways: 1,
    });
    const dbSecret = new secretsmanager.Secret(this, "HogwartsDbCredentials", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "admin" }),
        generateStringKey: "password",
        excludeCharacters: "\"@/\\'",
      },
    });
    const cluster = new rds.DatabaseCluster(this, "HogwartsDbCluster", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_10_0,
      }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceProps: {
        vpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM
        ),
        publiclyAccessible: true,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      defaultDatabaseName: "HogwartsDb",
    });
    cluster.connections.allowFromAnyIpv4(
      ec2.Port.tcp(3306),
      "Allow MySQL access"
    );

    new cdk.CfnOutput(this, "HogwartsDbEndpoint", {
      value: cluster.clusterEndpoint.hostname,
    });
    new cdk.CfnOutput(this, "SecretArn", {
      value: dbSecret.secretArn,
    });

    const code = lambda.Code.fromAsset("src");

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS Notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        message VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const executeSqlLambda = new lambda.Function(this, "executeSqlLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "lambda/executeSqlLambda.handler",
      code: code,
      vpc,
    });
    executeSqlLambda.addEnvironment(
      "DB_HOST",
      cluster.clusterEndpoint.hostname
    );
    executeSqlLambda.addEnvironment("DB_SECRET", dbSecret.secretArn);

    dbSecret.grantRead(executeSqlLambda);

    new custom_resources.AwsCustomResource(this, "CreateTableCustomResource", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: executeSqlLambda.functionName,
          Payload: JSON.stringify({
            ResourceProperties: {
              secretArn: dbSecret.secretArn,
              endpoint: cluster.clusterEndpoint.hostname,
              sqlScript: createTableSql,
            },
          }),
        },
        physicalResourceId:
          custom_resources.PhysicalResourceId.of("CreateTable"),
      },
      onUpdate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: executeSqlLambda.functionName,
          Payload: JSON.stringify({
            ResourceProperties: {
              secretArn: dbSecret.secretArn,
              endpoint: cluster.clusterEndpoint.hostname,
              sqlScript: createTableSql,
            },
          }),
        },
        physicalResourceId:
          custom_resources.PhysicalResourceId.of("CreateTable"),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["lambda:InvokeFunction"],
          resources: [executeSqlLambda.functionArn],
        }),
      ]),
    });
    // LAMBDA DEFINITIONS ******************************************
    // retrieve notifications
    const retrieveNotificationsLambda = new lambda.Function(
      this,
      "retrieveNotificationsLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "lambda/retrieveNotifications.handler",
        code: code,
      }
    );
    const retrieveNotificationsLambdaUrl =
      retrieveNotificationsLambda.addFunctionUrl({
        authType: lambda.FunctionUrlAuthType.NONE,
      });
    new cdk.CfnOutput(this, "retrieveNotificationsLambdaUrlOutput", {
      value: retrieveNotificationsLambdaUrl.url,
    });
    retrieveNotificationsLambda.addEnvironment(
      "DB_HOST",
      cluster.clusterEndpoint.hostname
    );
    retrieveNotificationsLambda.addEnvironment("DB_SECRET", dbSecret.secretArn);

    // process notification
    const processNotificationsLambda = new lambda.Function(
      this,
      "processNotificationsLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "lambda/processNotifications.handler",
        code: code,
      }
    );
    const processNotificationsLambdaUrl =
      processNotificationsLambda.addFunctionUrl({
        authType: lambda.FunctionUrlAuthType.NONE,
      });
    new cdk.CfnOutput(this, "processNotificationsLambdaUrlOutput", {
      value: processNotificationsLambdaUrl.url,
    });
    processNotificationsLambda.addEnvironment(
      "DB_HOST",
      cluster.clusterEndpoint.hostname
    );
    processNotificationsLambda.addEnvironment("DB_SECRET", dbSecret.secretArn);

    // notification queue
    const notificationQueue = new sqs.Queue(this, "notificationQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
    });
    // assign queue to lambda
    processNotificationsLambda.addEventSource(
      new SqsEventSource(notificationQueue)
    );

    // add notification
    const addNotificationLambda = new lambda.Function(
      this,
      "addNotificationLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "lambda/addNotification.handler",
        code: code,
        vpc,
        timeout: cdk.Duration.seconds(10),
      }
    );
    const addNotificationLambdaUrl = addNotificationLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });
    addNotificationLambda.addEnvironment(
      "NOTIFICATION_QUEUE_URL",
      notificationQueue.queueUrl
    );
    addNotificationLambda.addEnvironment(
      "DB_HOST",
      cluster.clusterEndpoint.hostname
    );
    addNotificationLambda.addEnvironment("DB_SECRET", dbSecret.secretArn);
    new cdk.CfnOutput(this, "addNotificationLambdaUrlOutput", {
      value: addNotificationLambdaUrl.url,
    });

    dbSecret.grantRead(retrieveNotificationsLambda);
    dbSecret.grantRead(addNotificationLambda);
    dbSecret.grantRead(processNotificationsLambda);

    // API DEFINITION ***************************************************
    const api = new apigw.RestApi(this, "MyApiGateway", {
      restApiName: "MyServiceApi",
    });

    const notificationsResource = api.root.addResource("notifications");
    const notificationByRecipient =
      notificationsResource.addResource("{recipient}");
    notificationByRecipient.addMethod(
      "GET",
      new apigw.LambdaIntegration(retrieveNotificationsLambda)
    );

    notificationsResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(addNotificationLambda)
    );
  }
}
